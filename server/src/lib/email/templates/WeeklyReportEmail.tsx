import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";
import * as React from "react";
import type { SiteReport, MetricData } from "../../../services/weekyReports/weeklyReportTypes.js";

interface WeeklyReportEmailProps {
  userName: string;
  organizationName: string;
  site: SiteReport;
}

const calculateGrowth = (current: number | null | undefined, previous: number | null | undefined): string => {
  const curr = current ?? 0;
  const prev = previous ?? 0;
  if (prev === 0) return curr > 0 ? "+100%" : "0%";
  const growth = ((curr - prev) / prev) * 100;
  const sign = growth > 0 ? "+" : "";
  return `${sign}${growth.toFixed(1)}%`;
};

const growthPositive = (
  current: number | null | undefined,
  previous: number | null | undefined,
  lowerIsBetter = false
): boolean => {
  const curr = current ?? 0;
  const prev = previous ?? 0;
  if (lowerIsBetter) return curr <= prev;
  return curr >= prev;
};

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

const formatNumber = (num: number | null | undefined): string => {
  if (num == null || isNaN(num)) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return Math.round(num).toLocaleString();
};

const formatMoney = (cents: number | null | undefined): string => {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
};

const safeToFixed = (num: number | null | undefined, decimals: number = 1): string => {
  if (num == null || isNaN(num)) return "0";
  return num.toFixed(decimals);
};

const regionNamesInEnglish = new Intl.DisplayNames(["en"], { type: "region" });

const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const getCountryDisplay = (countryCode: string): string => {
  try {
    const flag = getCountryFlag(countryCode);
    const name = regionNamesInEnglish.of(countryCode.toUpperCase()) || countryCode;
    return `${flag} ${name}`;
  } catch {
    return countryCode;
  }
};

/** Map raw crawler patterns to product names for AI answers. */
const agentDisplayName = (pattern: string): string => {
  const p = pattern.toLowerCase();
  if (p.includes("chatgpt") || p.includes("gptbot") || p.includes("openai")) {
    if (p.includes("chatgpt-user") || p.includes("answer_fetch")) return "ChatGPT";
    return "OpenAI";
  }
  if (p.includes("claude") || p.includes("anthropic")) {
    if (p.includes("claude-user") || p.includes("answer_fetch")) return "Claude";
    return "Anthropic";
  }
  if (p.includes("perplexity")) return "Perplexity";
  if (p.includes("google")) return "Google";
  // Strip purpose prefix
  const colon = pattern.indexOf(":");
  return colon > 0 ? pattern.slice(colon + 1) : pattern;
};

const MetricRow = ({
  emoji,
  label,
  value,
  growth,
  positive,
}: {
  emoji: string;
  label: string;
  value: string;
  growth: string;
  positive: boolean;
}) => (
  <Text style={{ color: "#111827", fontSize: "15px", margin: "0 0 8px 0", lineHeight: "1.5" }}>
    {emoji} <strong>{value}</strong> {label}{" "}
    <span style={{ color: positive ? "#059669" : "#dc2626", fontSize: "13px" }}>
      ({positive ? "🟢" : "🔴"} {growth})
    </span>
  </Text>
);

const ListSection = ({
  title,
  items,
  renderLine,
}: {
  title: string;
  items: MetricData[];
  renderLine: (item: MetricData, index: number) => React.ReactNode;
}) => {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: "20px" }}>
      <Text style={{ color: "#111827", fontSize: "14px", fontWeight: 600, margin: "0 0 8px 0" }}>{title}</Text>
      {items.map((item, i) => (
        <Text key={i} style={{ color: "#374151", fontSize: "14px", margin: "0 0 4px 0", lineHeight: "1.45" }}>
          {renderLine(item, i)}
        </Text>
      ))}
    </div>
  );
};

export const WeeklyReportEmail = ({ userName, organizationName, site }: WeeklyReportEmailProps) => {
  const currentYear = new Date().getFullYear();
  const firstName = (userName || "there").split(" ")[0];
  const periodLabel = `${site.periodStart} – ${site.periodEnd}`;
  const visitors = site.currentWeek.users ?? 0;
  const prevVisitors = site.previousWeek.users ?? 0;
  const revenue = site.revenue;
  const revPerVisitor =
    visitors > 0 && revenue ? revenue.revenue_cents / visitors : 0;
  const conversionRate =
    visitors > 0 && revenue ? (revenue.paying_users / visitors) * 100 : 0;
  const topDevice = site.deviceBreakdown[0];
  const topBrowser = site.browserBreakdown[0];
  const dashboardUrl = site.dashboardUrl || `https://analytics.milh.tech/${site.siteId}`;

  return (
    <Html>
      <Head />
      <Preview>
        {site.siteDomain}: {formatNumber(visitors)} visitors · {periodLabel}
      </Preview>
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                brand: "#10b981",
                darkText: "#111827",
                mutedText: "#6b7280",
                borderColor: "#e5e7eb",
              },
            },
          },
        }}
      >
        <Body className="bg-white font-sans">
          <Container className="mx-auto py-8 px-6 max-w-[600px]">
            <Text style={{ color: "#111827", fontSize: "18px", fontWeight: 600, margin: "0 0 4px 0" }}>
              Your analytics report for {site.siteDomain}
            </Text>
            <Text style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 20px 0" }}>{periodLabel}</Text>

            <Text style={{ color: "#111827", fontSize: "15px", margin: "0 0 16px 0" }}>Hi {firstName},</Text>

            <Section style={{ marginBottom: "24px" }}>
              <MetricRow
                emoji="👥"
                label="visitors"
                value={formatNumber(visitors)}
                growth={calculateGrowth(visitors, prevVisitors)}
                positive={growthPositive(visitors, prevVisitors)}
              />
              {revenue && (
                <>
                  <MetricRow
                    emoji="💰"
                    label="revenue"
                    value={formatMoney(revenue.revenue_cents)}
                    growth={calculateGrowth(revenue.revenue_cents, revenue.previous_revenue_cents)}
                    positive={growthPositive(revenue.revenue_cents, revenue.previous_revenue_cents)}
                  />
                  <MetricRow
                    emoji="🤑"
                    label="revenue per visitor"
                    value={formatMoney(revPerVisitor)}
                    growth={calculateGrowth(
                      revPerVisitor,
                      prevVisitors > 0 ? revenue.previous_revenue_cents / prevVisitors : 0
                    )}
                    positive={growthPositive(
                      revPerVisitor,
                      prevVisitors > 0 ? revenue.previous_revenue_cents / prevVisitors : 0
                    )}
                  />
                  <MetricRow
                    emoji="💯"
                    label="conversion rate"
                    value={`${safeToFixed(conversionRate, 2)}%`}
                    growth={calculateGrowth(revenue.paying_users, 0)}
                    positive={conversionRate > 0}
                  />
                </>
              )}
              <MetricRow
                emoji="💥"
                label="bounce rate"
                value={`${safeToFixed(site.currentWeek.bounce_rate, 0)}%`}
                growth={calculateGrowth(site.currentWeek.bounce_rate, site.previousWeek.bounce_rate)}
                positive={growthPositive(site.currentWeek.bounce_rate, site.previousWeek.bounce_rate, true)}
              />
              <MetricRow
                emoji="🕒"
                label="session time"
                value={formatDuration(site.currentWeek.session_duration)}
                growth={calculateGrowth(site.currentWeek.session_duration, site.previousWeek.session_duration)}
                positive={growthPositive(site.currentWeek.session_duration, site.previousWeek.session_duration)}
              />
            </Section>

            <ListSection
              title="🔗 Top referrers"
              items={site.topReferrers}
              renderLine={item => (
                <>
                  {item.value}: {formatNumber(item.count)} visitors
                  {item.revenue_cents != null ? ` and ${formatMoney(item.revenue_cents)} revenue` : ""}
                </>
              )}
            />

            <ListSection
              title="🌎 Top countries"
              items={site.topCountries}
              renderLine={item => (
                <>
                  {getCountryDisplay(item.value)}: {formatNumber(item.count)} visitors (
                  {safeToFixed(item.percentage, 0)}% of total)
                  {item.revenue_cents != null ? ` and ${formatMoney(item.revenue_cents)} revenue` : ""}
                </>
              )}
            />

            {(topDevice || topBrowser) && (
              <Text style={{ color: "#374151", fontSize: "14px", margin: "0 0 20px 0", lineHeight: "1.45" }}>
                💻 Most of your visitors come from{" "}
                <strong>{topBrowser?.value || "their browser"}</strong> on{" "}
                <strong>{(topDevice?.value || "desktop").toLowerCase()}</strong>
                {site.deviceBreakdown[0]?.percentage != null
                  ? ` (${safeToFixed(site.deviceBreakdown[0].percentage, 0)}%)`
                  : ""}
                .
              </Text>
            )}

            <ListSection
              title="📄 Top pages"
              items={site.topPages}
              renderLine={item => (
                <>
                  {item.value || "/"}: {formatNumber(item.count)} sessions ({safeToFixed(item.percentage, 0)}%)
                </>
              )}
            />

            {site.aiCrawlers && site.aiCrawlers.ai_answers > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <Text style={{ color: "#111827", fontSize: "14px", fontWeight: 600, margin: "0 0 8px 0" }}>
                  🤖 AI answer traffic
                </Text>
                <Text style={{ color: "#374151", fontSize: "14px", margin: "0 0 8px 0", lineHeight: "1.45" }}>
                  AI assistants fetched your website <strong>{formatNumber(site.aiCrawlers.ai_answers)}</strong> times
                  this week.
                </Text>
                {site.aiCrawlers.topAgents.map((agent, i) => (
                  <Text key={i} style={{ color: "#374151", fontSize: "14px", margin: "0 0 4px 0" }}>
                    {agentDisplayName(agent.value)}: {formatNumber(agent.count)} requests
                  </Text>
                ))}
                {site.aiCrawlers.topPages.length > 0 && (
                  <Text style={{ color: "#6b7280", fontSize: "13px", margin: "8px 0 0 0" }}>
                    Most crawled pages: {site.aiCrawlers.topPages.map(p => p.value || "/").join(", ")}
                  </Text>
                )}
              </div>
            )}

            {site.aiCrawlers && (site.aiCrawlers.indexing > 0 || site.aiCrawlers.training > 0) && (
              <Text style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 20px 0" }}>
                Also this week: {formatNumber(site.aiCrawlers.indexing)} indexing crawls ·{" "}
                {formatNumber(site.aiCrawlers.training)} training crawls
              </Text>
            )}

            <Text style={{ margin: "24px 0 8px 0" }}>
              <Link
                href={dashboardUrl}
                style={{
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  padding: "12px 20px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                View your analytics dashboard
              </Link>
            </Text>

            <Hr className="border-borderColor my-8" />

            <Text style={{ color: "#6b7280", fontSize: "12px", margin: "0 0 8px 0" }}>
              This report covers the last 7 days for {organizationName}.
            </Text>
            <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>
              <Link href={`${dashboardUrl.split("/").slice(0, 3).join("/")}/settings/account`} className="underline">
                Manage email preferences
              </Link>
              {" · "}© {currentYear} Analytics
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
