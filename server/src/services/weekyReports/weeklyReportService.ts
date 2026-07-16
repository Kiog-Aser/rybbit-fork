import * as cron from "node-cron";
import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { organization, member, user, sites } from "../../db/postgres/schema.js";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { processResults } from "../../api/analytics/utils/utils.js";
import { getBotPurposeExpression } from "../../api/analytics/bots/utils.js";
import { createServiceLogger } from "../../lib/logger/logger.js";
import { sendWeeklyReportEmail } from "../../lib/email/email.js";
import { filterSitesByMemberAccess } from "../../lib/siteAccess.js";
import { EMAIL_ENABLED, PUBLIC_BASE_URL, REVENUE_ATTRIBUTION, WEEKLY_REPORTS_ENABLED } from "../../lib/const.js";
import { getRevenueTotals } from "../revenue/stripeRevenueService.js";
import type {
  OverviewData,
  MetricData,
  SiteReport,
  OrganizationReport,
  AiCrawlerSummary,
  RevenueSummary,
} from "./weeklyReportTypes.js";

class WeeklyReportService {
  private cronTask: cron.ScheduledTask | null = null;
  private logger = createServiceLogger("weekly-report");

  private async fetchOverviewData(siteId: number, startDate: string, endDate: string): Promise<OverviewData | null> {
    try {
      const query = `SELECT
        session_stats.sessions,
        session_stats.pages_per_session,
        session_stats.bounce_rate * 100 AS bounce_rate,
        session_stats.session_duration,
        page_stats.pageviews,
        page_stats.users
      FROM
      (
          SELECT
              COUNT() AS sessions,
              AVG(pages_in_session) AS pages_per_session,
              sumIf(1, pages_in_session = 1) / COUNT() AS bounce_rate,
              AVG(end_time - start_time) AS session_duration
          FROM
              (
                  SELECT
                      session_id,
                      MIN(timestamp) AS start_time,
                      MAX(timestamp) AS end_time,
                      COUNT(CASE WHEN type = 'pageview' THEN 1 END) AS pages_in_session
                  FROM events
                  WHERE
                      site_id = {siteId:Int32}
                      AND timestamp >= toDateTime({startDate:String})
                      AND timestamp < toDateTime({endDate:String})
                  GROUP BY session_id
              )
          ) AS session_stats
          CROSS JOIN
          (
              SELECT
                  COUNT(*) AS pageviews,
                  COUNT(DISTINCT coalesce(nullIf(identified_user_id, ''), user_id)) AS users
              FROM events
              WHERE
                  site_id = {siteId:Int32}
                  AND timestamp >= toDateTime({startDate:String})
                  AND timestamp < toDateTime({endDate:String})
                  AND type = 'pageview'
          ) AS page_stats`;

      const result = await clickhouse.query({
        query,
        format: "JSONEachRow",
        query_params: { siteId, startDate, endDate },
      });

      const data = await processResults<OverviewData>(result);
      return data[0] || null;
    } catch (error) {
      this.logger.error({ error, siteId }, "Error fetching overview data");
      return null;
    }
  }

  private async fetchTopN(
    siteId: number,
    parameter: string,
    startDate: string,
    endDate: string,
    limit: number = 5
  ): Promise<MetricData[]> {
    try {
      let query = "";

      if (parameter === "country") {
        query = `
          WITH PageStats AS (
            SELECT
              country as value,
              COUNT(distinct(session_id)) as unique_sessions
            FROM events
            WHERE
                site_id = {siteId:Int32}
                AND country IS NOT NULL
                AND country <> ''
                AND timestamp >= toDateTime({startDate:String})
                AND timestamp < toDateTime({endDate:String})
            GROUP BY value
          )
          SELECT
            value,
            unique_sessions as count,
            round((unique_sessions / sum(unique_sessions) OVER ()) * 100, 2) as percentage
          FROM PageStats
          ORDER BY count desc
          LIMIT {limit:Int32}`;
      } else if (parameter === "pathname") {
        query = `
          WITH PathStats AS (
              SELECT
                  pathname,
                  count(DISTINCT session_id) as unique_sessions
              FROM events
              WHERE
                site_id = {siteId:Int32}
                AND type = 'pageview'
                AND timestamp >= toDateTime({startDate:String})
                AND timestamp < toDateTime({endDate:String})
              GROUP BY pathname
          )
          SELECT
              pathname as value,
              unique_sessions as count,
              round((unique_sessions / sum(unique_sessions) OVER ()) * 100, 2) as percentage
          FROM PathStats
          ORDER BY unique_sessions DESC
          LIMIT {limit:Int32}`;
      } else if (parameter === "referrer") {
        query = `
          WITH PageStats AS (
            SELECT
              domainWithoutWWW(referrer) as value,
              COUNT(distinct(session_id)) as unique_sessions
            FROM events
            WHERE
                site_id = {siteId:Int32}
                AND domainWithoutWWW(referrer) IS NOT NULL
                AND domainWithoutWWW(referrer) <> ''
                AND timestamp >= toDateTime({startDate:String})
                AND timestamp < toDateTime({endDate:String})
            GROUP BY value
          )
          SELECT
            value,
            unique_sessions as count,
            round((unique_sessions / sum(unique_sessions) OVER ()) * 100, 2) as percentage
          FROM PageStats
          ORDER BY count desc
          LIMIT {limit:Int32}`;
      } else if (parameter === "device_type" || parameter === "browser" || parameter === "operating_system") {
        query = `
          WITH PageStats AS (
            SELECT
              ${parameter} as value,
              COUNT(distinct(session_id)) as unique_sessions
            FROM events
            WHERE
                site_id = {siteId:Int32}
                AND ${parameter} IS NOT NULL
                AND ${parameter} <> ''
                AND timestamp >= toDateTime({startDate:String})
                AND timestamp < toDateTime({endDate:String})
            GROUP BY value
          )
          SELECT
            value,
            unique_sessions as count,
            round((unique_sessions / sum(unique_sessions) OVER ()) * 100, 2) as percentage
          FROM PageStats
          ORDER BY count desc
          LIMIT {limit:Int32}`;
      }

      if (!query) return [];

      const result = await clickhouse.query({
        query,
        format: "JSONEachRow",
        query_params: { siteId, startDate, endDate, limit },
      });

      return await processResults<MetricData>(result);
    } catch (error) {
      this.logger.error({ error, siteId, parameter }, "Error fetching top N data");
      return [];
    }
  }

  private async fetchRevenueSummary(
    siteId: number,
    currentStart: string,
    currentEnd: string,
    previousStart: string,
    previousEnd: string
  ): Promise<RevenueSummary | null> {
    if (!REVENUE_ATTRIBUTION) return null;
    try {
      const [current, previous] = await Promise.all([
        getRevenueTotals(siteId, currentStart, currentEnd),
        getRevenueTotals(siteId, previousStart, previousEnd),
      ]);
      return {
        revenue_cents: current.revenue_cents ?? 0,
        payment_count: current.payment_count ?? 0,
        paying_users: current.paying_users ?? 0,
        previous_revenue_cents: previous.revenue_cents ?? 0,
      };
    } catch (error) {
      this.logger.error({ error, siteId }, "Error fetching revenue for weekly report");
      return null;
    }
  }

  private async fetchAiCrawlerSummary(
    siteId: number,
    startDate: string,
    endDate: string
  ): Promise<AiCrawlerSummary | null> {
    try {
      const purpose = getBotPurposeExpression();
      const overviewResult = await clickhouse.query({
        query: `
          SELECT
            count() AS total_requests,
            countIf(purpose = 'ai_answers') AS ai_answers,
            countIf(purpose = 'indexing') AS indexing,
            countIf(purpose = 'training') AS training
          FROM (
            SELECT ${purpose} AS purpose
            FROM bot_events
            WHERE site_id = {siteId:Int32}
              AND timestamp >= toDateTime({startDate:String})
              AND timestamp < toDateTime({endDate:String})
          )
          WHERE purpose != ''
        `,
        format: "JSONEachRow",
        query_params: { siteId, startDate, endDate },
      });
      const [overview] = await processResults<{
        total_requests: number;
        ai_answers: number;
        indexing: number;
        training: number;
      }>(overviewResult);

      if (!overview || overview.total_requests === 0) {
        return {
          total_requests: 0,
          ai_answers: 0,
          indexing: 0,
          training: 0,
          topAgents: [],
          topPages: [],
        };
      }

      const agentsResult = await clickhouse.query({
        query: `
          SELECT
            matched_ua_pattern as value,
            count() as count,
            round(count() * 100.0 / sum(count()) OVER (), 2) as percentage
          FROM bot_events
          WHERE site_id = {siteId:Int32}
            AND timestamp >= toDateTime({startDate:String})
            AND timestamp < toDateTime({endDate:String})
            AND matched_ua_pattern != ''
            AND ${purpose} = 'ai_answers'
          GROUP BY matched_ua_pattern
          ORDER BY count DESC
          LIMIT 5
        `,
        format: "JSONEachRow",
        query_params: { siteId, startDate, endDate },
      });

      const pagesResult = await clickhouse.query({
        query: `
          SELECT
            pathname as value,
            count() as count,
            round(count() * 100.0 / sum(count()) OVER (), 2) as percentage
          FROM bot_events
          WHERE site_id = {siteId:Int32}
            AND timestamp >= toDateTime({startDate:String})
            AND timestamp < toDateTime({endDate:String})
            AND pathname != ''
            AND ${purpose} = 'ai_answers'
          GROUP BY pathname
          ORDER BY count DESC
          LIMIT 5
        `,
        format: "JSONEachRow",
        query_params: { siteId, startDate, endDate },
      });

      return {
        total_requests: overview.total_requests,
        ai_answers: overview.ai_answers,
        indexing: overview.indexing,
        training: overview.training,
        topAgents: await processResults<MetricData>(agentsResult),
        topPages: await processResults<MetricData>(pagesResult),
      };
    } catch (error) {
      // bot_events may not exist yet on older DBs
      this.logger.warn({ error, siteId }, "AI crawler summary unavailable for weekly report");
      return null;
    }
  }

  private async generateSiteReport(siteId: number, siteName: string, siteDomain: string): Promise<SiteReport | null> {
    try {
      const now = DateTime.utc();
      const currentWeekEnd = now;
      const currentWeekStart = now.minus({ days: 7 });
      const previousWeekEnd = currentWeekStart;
      const previousWeekStart = currentWeekStart.minus({ days: 7 });
      const formatDate = (date: DateTime) => date.toFormat("yyyy-MM-dd HH:mm:ss");

      const currentStart = formatDate(currentWeekStart);
      const currentEnd = formatDate(currentWeekEnd);
      const previousStart = formatDate(previousWeekStart);
      const previousEnd = formatDate(previousWeekEnd);

      const [
        currentWeek,
        previousWeek,
        topCountries,
        topPages,
        topReferrers,
        deviceBreakdown,
        browserBreakdown,
        revenue,
        aiCrawlers,
      ] = await Promise.all([
        this.fetchOverviewData(siteId, currentStart, currentEnd),
        this.fetchOverviewData(siteId, previousStart, previousEnd),
        this.fetchTopN(siteId, "country", currentStart, currentEnd, 5),
        this.fetchTopN(siteId, "pathname", currentStart, currentEnd, 5),
        this.fetchTopN(siteId, "referrer", currentStart, currentEnd, 5),
        this.fetchTopN(siteId, "device_type", currentStart, currentEnd, 5),
        this.fetchTopN(siteId, "browser", currentStart, currentEnd, 3),
        this.fetchRevenueSummary(siteId, currentStart, currentEnd, previousStart, previousEnd),
        this.fetchAiCrawlerSummary(siteId, currentStart, currentEnd),
      ]);

      if (!currentWeek) return null;
      if (!currentWeek.pageviews || currentWeek.pageviews === 0) return null;

      return {
        siteId,
        siteName,
        siteDomain,
        periodStart: currentWeekStart.toFormat("dd MMM"),
        periodEnd: currentWeekEnd.toFormat("dd MMM yyyy"),
        currentWeek,
        previousWeek: previousWeek || {
          sessions: 0,
          pageviews: 0,
          users: 0,
          pages_per_session: 0,
          bounce_rate: 0,
          session_duration: 0,
        },
        topCountries,
        topPages,
        topReferrers,
        deviceBreakdown,
        browserBreakdown,
        revenue,
        aiCrawlers,
        dashboardUrl: `${PUBLIC_BASE_URL}/${siteId}`,
      };
    } catch (error) {
      this.logger.error({ error, siteId }, "Error generating site report");
      return null;
    }
  }

  private async generateOrganizationReport(organizationId: string): Promise<OrganizationReport | null> {
    try {
      const [org] = await db.select().from(organization).where(eq(organization.id, organizationId));
      if (!org) return null;

      const orgSites = await db.select().from(sites).where(eq(sites.organizationId, org.id));
      if (orgSites.length === 0) return null;

      const siteReports: SiteReport[] = [];
      for (const site of orgSites) {
        const report = await this.generateSiteReport(site.siteId, site.name, site.domain);
        if (report) siteReports.push(report);
      }

      if (siteReports.length === 0) return null;

      return {
        organizationId: org.id,
        organizationName: org.name,
        sites: siteReports,
      };
    } catch (error) {
      this.logger.error({ error, organizationId }, "Error generating organization report");
      return null;
    }
  }

  private async sendReportsToOrganization(report: OrganizationReport): Promise<void> {
    try {
      const members = await db
        .select({
          memberId: member.id,
          userId: member.userId,
          role: member.role,
          email: user.email,
          name: user.name,
          sendAutoEmailReports: user.sendAutoEmailReports,
          hasRestrictedSiteAccess: member.hasRestrictedSiteAccess,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, report.organizationId));

      for (const memberData of members) {
        if (memberData.sendAutoEmailReports === false) continue;

        let allowedSites = report.sites;
        if (memberData.role === "member") {
          allowedSites = await filterSitesByMemberAccess(
            report.sites,
            report.organizationId,
            memberData.userId,
            memberData.memberId,
            memberData.hasRestrictedSiteAccess
          );
          if (allowedSites.length === 0) continue;
        }

        for (const site of allowedSites) {
          try {
            await sendWeeklyReportEmail(memberData.email, memberData.name, report.organizationName, site);
            this.logger.info(
              {
                email: memberData.email,
                organizationId: report.organizationId,
                siteId: site.siteId,
                siteName: site.siteName,
              },
              "Sent weekly report email for site"
            );
          } catch (error) {
            this.logger.error(
              { error, email: memberData.email, organizationId: report.organizationId, siteId: site.siteId },
              "Failed to send email to member for site"
            );
          }
        }
      }
    } catch (error) {
      this.logger.error({ error, organizationId: report.organizationId }, "Error sending reports to organization");
    }
  }

  public async generateAndSendReports(): Promise<void> {
    if (!WEEKLY_REPORTS_ENABLED) {
      this.logger.info("Skipping weekly reports (WEEKLY_REPORTS_ENABLED=false or no RESEND_API_KEY)");
      return;
    }
    if (!EMAIL_ENABLED) {
      this.logger.warn("Weekly reports enabled but RESEND_API_KEY is missing — emails will not send");
    }

    this.logger.info("Starting weekly report generation and sending");

    try {
      const organizations = await db.select().from(organization);
      const totalOrgs = organizations.length;
      this.logger.info({ totalOrganizations: totalOrgs }, "Processing organizations");

      let processedCount = 0;
      let sentCount = 0;

      for (const org of organizations) {
        const report = await this.generateOrganizationReport(org.id);
        if (report) {
          await this.sendReportsToOrganization(report);
          sentCount++;
        }
        processedCount++;

        if (processedCount % 10 === 0 || processedCount === totalOrgs) {
          this.logger.info(
            { processed: processedCount, total: totalOrgs, sent: sentCount },
            `Progress: ${processedCount}/${totalOrgs} organizations processed, ${sentCount} reports sent`
          );
        }
      }

      this.logger.info(
        { totalProcessed: processedCount, totalSent: sentCount },
        "Completed weekly report generation and sending"
      );
    } catch (error) {
      this.logger.error({ error }, "Error in weekly report generation");
    }
  }

  /** Generate a report for one site (for testing / manual triggers). */
  public async generateSiteReportForId(siteId: number): Promise<SiteReport | null> {
    const [site] = await db.select().from(sites).where(eq(sites.siteId, siteId));
    if (!site) return null;
    return this.generateSiteReport(site.siteId, site.name, site.domain);
  }

  private initializeWeeklyReportCron(): void {
    if (!WEEKLY_REPORTS_ENABLED) {
      this.logger.info("Skipping weekly report cron (not enabled)");
      return;
    }

    this.logger.info("Initializing weekly report cron");

    // Every Monday at 09:00 UTC (closer to “morning report” than midnight)
    this.cronTask = cron.schedule(
      "0 9 * * 1",
      async () => {
        try {
          await this.generateAndSendReports();
        } catch (error) {
          this.logger.error(error as Error, "Error during weekly report generation");
        }
      },
      { timezone: "UTC" }
    );

    this.logger.info("Weekly report cron initialized (Mondays 09:00 UTC)");
  }

  public stopWeeklyReportCron(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.logger.info("Weekly report cron stopped");
    }
  }

  public startWeeklyReportCron(): void {
    this.initializeWeeklyReportCron();
  }
}

export const weeklyReportService = new WeeklyReportService();
