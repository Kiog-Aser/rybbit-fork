export interface OverviewData {
  sessions: number;
  pageviews: number;
  users: number;
  pages_per_session: number | null;
  bounce_rate: number | null;
  session_duration: number;
}

export interface MetricData {
  value: string;
  count: number;
  percentage: number | null;
  /** Optional attributed revenue in cents (when revenue attribution is on). */
  revenue_cents?: number;
}

export interface RevenueSummary {
  revenue_cents: number;
  payment_count: number;
  paying_users: number;
  previous_revenue_cents: number;
}

export interface AiCrawlerSummary {
  total_requests: number;
  ai_answers: number;
  indexing: number;
  training: number;
  topAgents: MetricData[];
  topPages: MetricData[];
}

export interface SiteReport {
  siteId: number;
  siteName: string;
  siteDomain: string;
  /** Inclusive start of the report window (UTC date string). */
  periodStart: string;
  /** Inclusive end of the report window (UTC date string). */
  periodEnd: string;
  currentWeek: OverviewData;
  previousWeek: OverviewData;
  topCountries: MetricData[];
  topPages: MetricData[];
  topReferrers: MetricData[];
  deviceBreakdown: MetricData[];
  browserBreakdown: MetricData[];
  revenue?: RevenueSummary | null;
  aiCrawlers?: AiCrawlerSummary | null;
  /** Dashboard base URL for CTA links. */
  dashboardUrl: string;
}

export interface OrganizationReport {
  organizationId: string;
  organizationName: string;
  sites: SiteReport[];
}
