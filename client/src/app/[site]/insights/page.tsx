"use client";

import NumberFlow from "@number-flow/react";
import { DateTime } from "luxon";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { useGetOverview } from "../../../api/analytics/hooks/useGetOverview";
import { usePaginatedMetric } from "../../../api/analytics/hooks/useGetMetric";
import { useCurrentSite } from "../../../api/admin/hooks/useSites";
import { useRevenueByDimension, useRevenueOverview } from "../../../api/revenue/hooks";
import { Favicon } from "../../../components/Favicon";
import { Card, CardContent } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { REVENUE_ATTRIBUTION } from "../../../lib/const";
import { getTimezone, useStore } from "../../../lib/store";
import { getCountryName } from "../../../lib/utils";
import { CountryFlag } from "../components/shared/icons/CountryFlag";
import { Browser } from "../components/shared/icons/Browser";
import { DeviceIcon } from "../components/shared/icons/Device";
import { OperatingSystem } from "../components/shared/icons/OperatingSystem";
import { SubHeader } from "../components/SubHeader/SubHeader";

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatMoneyPrecise(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function periodLabel(
  time: ReturnType<typeof useStore.getState>["time"],
  t: (s: string) => string
): string {
  if (time.mode === "day") {
    return DateTime.fromISO(time.day).toFormat("MMM d, yyyy");
  }
  if (time.mode === "range" && time.startDate && time.endDate) {
    return `${DateTime.fromISO(time.startDate).toFormat("MMM d")} – ${DateTime.fromISO(time.endDate).toFormat("MMM d, yyyy")}`;
  }
  if (time.mode === "week") return t("This week");
  if (time.mode === "month") return t("This month");
  if (time.mode === "year") return t("This year");
  if (time.mode === "past-minutes") {
    if (time.pastMinutesStart === 1440) return t("Last 24 hours");
    if (time.pastMinutesStart === 60) return t("Last hour");
    return t("Recent");
  }
  if (time.mode === "all-time") return t("All time");
  return t("Selected period");
}

function dayCount(time: ReturnType<typeof useStore.getState>["time"]): number {
  if (time.mode === "day") return 1;
  if (time.mode === "week") return 7;
  if (time.mode === "month") return 30;
  if (time.mode === "year") return 365;
  if (time.mode === "range" && time.startDate && time.endDate) {
    const start = DateTime.fromISO(time.startDate);
    const end = DateTime.fromISO(time.endDate);
    return Math.max(1, Math.round(end.diff(start, "days").days) + 1);
  }
  if (time.mode === "past-minutes") {
    return Math.max(1, Math.round((time.pastMinutesStart ?? 1440) / 1440));
  }
  return 30;
}

function StatCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <Card className="border-neutral-800/80 bg-neutral-900/40">
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <div className={`mt-2 text-2xl font-semibold tabular-nums ${accent ? "text-accent-400" : ""}`}>
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RankList({
  title,
  loading,
  rows,
  empty,
}: {
  title: string;
  loading: boolean;
  empty: string;
  rows: Array<{ key: string; label: React.ReactNode; primary: string; secondary?: string }>;
}) {
  return (
    <Card className="border-neutral-800/80 bg-neutral-900/40 h-full">
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">{title}</p>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{empty}</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map(row => (
              <div key={row.key} className="flex items-center justify-between gap-3 text-sm py-1">
                <div className="min-w-0 flex-1 truncate">{row.label}</div>
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  {row.secondary && (
                    <span className="text-xs text-muted-foreground">{row.secondary}</span>
                  )}
                  <span className="font-medium text-accent-400 min-w-[3.5rem] text-right">{row.primary}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const t = useExtracted();
  const { time } = useStore();
  const { site } = useCurrentSite();
  const { data: overview, isLoading: overviewLoading } = useGetOverview({});
  const { data: revenue, isLoading: revenueLoading } = useRevenueOverview();
  const { data: revenueCountries, isLoading: revCountriesLoading } = useRevenueByDimension("country");
  const { data: revenueChannels, isLoading: revChannelsLoading } = useRevenueByDimension("channel");
  const { data: revenueReferrers, isLoading: revReferrersLoading } = useRevenueByDimension("referrer");
  const { data: devices } = usePaginatedMetric({ parameter: "device_type", limit: 5, page: 1, lite: true });
  const { data: browsers } = usePaginatedMetric({ parameter: "browser", limit: 5, page: 1, lite: true });
  const { data: systems } = usePaginatedMetric({ parameter: "operating_system", limit: 5, page: 1, lite: true });
  const { data: pages } = usePaginatedMetric({ parameter: "pathname", limit: 5, page: 1, lite: true });

  useSetPageTitle(t("Insights"));

  const days = dayCount(time);
  const visitors = overview?.data?.users ?? 0;
  const sessions = overview?.data?.sessions ?? 0;
  const bounce = overview?.data?.bounce_rate ?? 0;
  const durationSec = overview?.data?.session_duration ?? 0;
  const revenueCents = revenue?.totals.revenue_cents ?? 0;
  const payingUsers = revenue?.totals.paying_users ?? 0;
  const paymentCount = revenue?.totals.payment_count ?? 0;

  const avgDailyVisitors = visitors / days;
  const avgDailyRevenue = revenueCents / days;
  const revPerVisitor = visitors > 0 ? revenueCents / visitors : 0;
  const conversionRate = visitors > 0 ? (payingUsers / visitors) * 100 : 0;

  const domain = site?.domain ?? "";
  const siteName = site?.name || domain || t("Your site");
  const label = periodLabel(time, t);
  const timezone = getTimezone();

  const topDevice = devices?.data?.[0];
  const topBrowser = browsers?.data?.[0];
  const topOs = systems?.data?.[0];

  const countryRows = useMemo(() => {
    return (revenueCountries ?? []).slice(0, 6).map(row => ({
      key: row.value,
      label: (
        <span className="inline-flex items-center gap-2 min-w-0">
          <CountryFlag country={row.value} />
          <span className="truncate">{getCountryName(row.value) || row.value}</span>
        </span>
      ),
      primary: formatMoney(row.revenue_cents),
      secondary: `${row.payment_count} ${t("payments")}`,
    }));
  }, [revenueCountries, t]);

  const channelRows = useMemo(() => {
    return (revenueChannels ?? []).slice(0, 6).map(row => ({
      key: row.value,
      label: <span className="capitalize truncate">{row.value}</span>,
      primary: formatMoney(row.revenue_cents),
      secondary: `${row.payment_count}`,
    }));
  }, [revenueChannels]);

  const referrerRows = useMemo(() => {
    return (revenueReferrers ?? []).slice(0, 6).map(row => ({
      key: row.value,
      label: (
        <span className="inline-flex items-center gap-2 min-w-0">
          {row.value !== "direct" && <Favicon domain={row.value} className="w-3.5 h-3.5" />}
          <span className="truncate">{row.value === "direct" ? t("Direct") : row.value}</span>
        </span>
      ),
      primary: formatMoney(row.revenue_cents),
    }));
  }, [revenueReferrers, t]);

  const pageRows = useMemo(() => {
    return (pages?.data ?? []).slice(0, 6).map(row => ({
      key: row.value,
      label: <span className="truncate font-mono text-xs">{row.value || "/"}</span>,
      primary: row.count.toLocaleString(),
      secondary: `${round(row.percentage)}%`,
    }));
  }, [pages?.data]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-2 md:p-4 pb-16">
      <SubHeader />

      {/* Hero identity panel — inspired by DataFast insights, Rybbit styling */}
      <Card className="overflow-hidden border-neutral-800/80 bg-gradient-to-b from-neutral-900/80 to-neutral-950/90">
        <CardContent className="relative p-8 md:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_60%)]" />
          <div className="relative flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-700/80 bg-neutral-900 shadow-lg shadow-black/40">
              {domain ? (
                <Favicon domain={domain} className="h-9 w-9 rounded-lg" />
              ) : (
                <span className="text-2xl font-semibold text-accent-400">R</span>
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{siteName}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">{timezone}</p>
            </div>

            <div className="mt-2 grid w-full max-w-lg grid-cols-2 gap-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("Avg. daily visitors")}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {overviewLoading ? (
                    "—"
                  ) : (
                    <NumberFlow
                      value={Math.round(avgDailyVisitors)}
                      format={{ notation: avgDailyVisitors >= 1000 ? "compact" : "standard" }}
                    />
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("Avg. daily revenue")}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-accent-400">
                  {!REVENUE_ATTRIBUTION || revenueLoading
                    ? "—"
                    : formatMoneyPrecise(avgDailyRevenue)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("Visitors")}
          loading={overviewLoading}
          value={<NumberFlow value={visitors} format={{ notation: "compact" }} />}
        />
        <StatCard
          label={t("Sessions")}
          loading={overviewLoading}
          value={<NumberFlow value={sessions} format={{ notation: "compact" }} />}
        />
        <StatCard
          label={t("Revenue")}
          loading={revenueLoading}
          accent
          value={REVENUE_ATTRIBUTION ? formatMoney(revenueCents) : "—"}
        />
        <StatCard
          label={t("Rev / visitor")}
          loading={revenueLoading || overviewLoading}
          accent
          value={REVENUE_ATTRIBUTION ? formatMoneyPrecise(revPerVisitor) : "—"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("Conversion rate")}
          loading={revenueLoading || overviewLoading}
          value={REVENUE_ATTRIBUTION ? `${conversionRate.toFixed(2)}%` : "—"}
        />
        <StatCard
          label={t("Paying visitors")}
          loading={revenueLoading}
          value={REVENUE_ATTRIBUTION ? payingUsers.toLocaleString() : "—"}
        />
        <StatCard
          label={t("Bounce rate")}
          loading={overviewLoading}
          value={`${Math.round(bounce)}%`}
        />
        <StatCard
          label={t("Avg. session")}
          loading={overviewLoading}
          value={durationSec ? `${Math.round(durationSec / 60)}m ${Math.round(durationSec % 60)}s` : "—"}
        />
      </div>

      {/* Audience composition */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-neutral-800/80 bg-neutral-900/40">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
              {t("Top device")}
            </p>
            {topDevice ? (
              <div className="flex items-center gap-3">
                <DeviceIcon deviceType={topDevice.value} size={28} />
                <div>
                  <p className="font-semibold">{topDevice.value || t("Unknown")}</p>
                  <p className="text-xs text-muted-foreground">
                    {round(topDevice.percentage)}% {t("of sessions")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-neutral-800/80 bg-neutral-900/40">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
              {t("Top browser")}
            </p>
            {topBrowser ? (
              <div className="flex items-center gap-3">
                <Browser browser={topBrowser.value} size={28} />
                <div>
                  <p className="font-semibold">{topBrowser.value || t("Unknown")}</p>
                  <p className="text-xs text-muted-foreground">
                    {round(topBrowser.percentage)}% {t("of sessions")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-neutral-800/80 bg-neutral-900/40">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
              {t("Top OS")}
            </p>
            {topOs ? (
              <div className="flex items-center gap-3">
                <OperatingSystem os={topOs.value} size={28} />
                <div>
                  <p className="font-semibold">{topOs.value || t("Unknown")}</p>
                  <p className="text-xs text-muted-foreground">
                    {round(topOs.percentage)}% {t("of sessions")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdowns + pages */}
      <div className="grid gap-3 lg:grid-cols-2">
        <RankList
          title={t("Top revenue by country")}
          loading={revCountriesLoading}
          empty={t("No revenue in this period")}
          rows={countryRows}
        />
        <RankList
          title={t("Top revenue by channel")}
          loading={revChannelsLoading}
          empty={t("No revenue in this period")}
          rows={channelRows}
        />
        <RankList
          title={t("Top revenue by referrer")}
          loading={revReferrersLoading}
          empty={t("No revenue in this period")}
          rows={referrerRows}
        />
        <RankList
          title={t("Top pages")}
          loading={false}
          empty={t("No pageviews yet")}
          rows={pageRows}
        />
      </div>

      {REVENUE_ATTRIBUTION && paymentCount > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {paymentCount.toLocaleString()} {t("successful payments")} · {payingUsers.toLocaleString()}{" "}
          {t("paying visitors")} · {t("conversion")} {conversionRate.toFixed(2)}%
        </p>
      )}
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
