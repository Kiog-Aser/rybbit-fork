"use client";

import NumberFlow from "@number-flow/react";
import { ArrowLeft } from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { useGetOverview } from "../../../api/analytics/hooks/useGetOverview";
import { usePaginatedMetric } from "../../../api/analytics/hooks/useGetMetric";
import { useCurrentSite } from "../../../api/admin/hooks/useSites";
import { useRevenueByDimension, useRevenueOverview } from "../../../api/revenue/hooks";
import { Time } from "../../../components/DateSelector/types";
import { Favicon } from "../../../components/Favicon";
import { Skeleton } from "../../../components/ui/skeleton";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { REVENUE_ATTRIBUTION } from "../../../lib/const";
import { getMainDashboardPath } from "../../../lib/siteRoute";
import { getTimezone, useStore } from "../../../lib/store";
import { cn, getCountryName } from "../../../lib/utils";
import { CountryFlag } from "../components/shared/icons/CountryFlag";
import { Browser } from "../components/shared/icons/Browser";
import { DeviceIcon } from "../components/shared/icons/Device";
import { OperatingSystem } from "../components/shared/icons/OperatingSystem";

/** Fixed rolling last-30-days window — independent of dashboard date filter. */
function useLast30Days(): Time {
  return useMemo(() => {
    const tz = getTimezone();
    const now = DateTime.now().setZone(tz);
    return {
      mode: "range" as const,
      startDate: now.minus({ days: 29 }).toISODate()!,
      endDate: now.toISODate()!,
      wellKnown: "last-30-days" as const,
    };
  }, []);
}

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

function formatPeriod(time: Time): string {
  if (time.mode === "range" && time.startDate && time.endDate) {
    const start = DateTime.fromISO(time.startDate);
    const end = DateTime.fromISO(time.endDate);
    if (start.year === end.year) {
      return `${start.toFormat("MMM d")} – ${end.toFormat("MMM d, yyyy")}`;
    }
    return `${start.toFormat("MMM d, yyyy")} – ${end.toFormat("MMM d, yyyy")}`;
  }
  return "Last 30 days";
}

/** Flat panel — design system radii (~4.8px), no shadow, surface token. */
function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-3 min-h-0 overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium text-muted-foreground mb-1.5 tracking-tight">{children}</p>
  );
}

function Metric({
  label,
  value,
  accent,
  loading,
  large,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  loading?: boolean;
  large?: boolean;
}) {
  return (
    <Panel className="flex flex-col justify-center">
      <PanelLabel>{label}</PanelLabel>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <div
          className={cn(
            "font-semibold tabular-nums tracking-tight",
            large ? "text-2xl md:text-3xl" : "text-xl md:text-2xl",
            accent ? "text-emerald-500 dark:text-emerald-400" : "text-foreground"
          )}
        >
          {value}
        </div>
      )}
    </Panel>
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
    <Panel className="flex flex-col">
      <PanelLabel>{title}</PanelLabel>
      {loading ? (
        <div className="space-y-1.5 flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center flex-1">{empty}</p>
      ) : (
        <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden">
          {rows.map(row => (
            <div key={row.key} className="flex items-center justify-between gap-2 text-xs py-0.5 min-w-0">
              <div className="min-w-0 flex-1 truncate text-foreground/90">{row.label}</div>
              <div className="flex items-center gap-2 shrink-0 tabular-nums">
                {row.secondary && <span className="text-muted-foreground">{row.secondary}</span>}
                <span className="font-medium text-emerald-500 dark:text-emerald-400 min-w-[2.5rem] text-right">
                  {row.primary}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function InsightsPage() {
  const t = useExtracted();
  const pathname = usePathname();
  const last30 = useLast30Days();
  const siteId = useStore(s => s.site);
  const { site } = useCurrentSite();

  // Same lite overview path as the main dashboard for consistent visitor counts.
  const { data: overview, isLoading: overviewLoading } = useGetOverview({
    site: siteId,
    overrideTime: last30,
    useFilters: false,
    lite: true,
  });
  const { data: revenue, isLoading: revenueLoading } = useRevenueOverview(last30);
  const { data: revenueCountries, isLoading: revCountriesLoading } = useRevenueByDimension("country", last30);
  const { data: revenueChannels, isLoading: revChannelsLoading } = useRevenueByDimension("channel", last30);
  const { data: revenueReferrers, isLoading: revReferrersLoading } = useRevenueByDimension("referrer", last30);
  const { data: devices } = usePaginatedMetric({
    parameter: "device_type",
    limit: 5,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });
  const { data: browsers } = usePaginatedMetric({
    parameter: "browser",
    limit: 5,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });
  const { data: systems } = usePaginatedMetric({
    parameter: "operating_system",
    limit: 5,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });
  const { data: pages } = usePaginatedMetric({
    parameter: "pathname",
    limit: 5,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });

  useSetPageTitle(t("Insights"));

  const days = 30;
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
  const period = formatPeriod(last30);
  const timezone = getTimezone();
  const backHref = getMainDashboardPath(pathname) ?? "/";

  const topDevice = devices?.data?.[0];
  const topBrowser = browsers?.data?.[0];
  const topOs = systems?.data?.[0];

  // Insight cards: % of revenue from top segment
  const topDeviceRev = useMemo(() => {
    if (!devices?.data?.length || !REVENUE_ATTRIBUTION) return null;
    // device revenue not always available; use session share as proxy when needed
    const d = devices.data[0];
    return { name: d.value, pct: d.percentage };
  }, [devices?.data]);

  const countryRows = useMemo(() => {
    return (revenueCountries ?? []).slice(0, 5).map(row => ({
      key: row.value,
      label: (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <CountryFlag country={row.value} />
          <span className="truncate">{getCountryName(row.value) || row.value}</span>
        </span>
      ),
      primary: formatMoney(row.revenue_cents),
      secondary: `${row.payment_count}`,
    }));
  }, [revenueCountries]);

  const channelRows = useMemo(() => {
    return (revenueChannels ?? []).slice(0, 5).map(row => ({
      key: row.value,
      label: <span className="capitalize truncate">{row.value}</span>,
      primary: formatMoney(row.revenue_cents),
    }));
  }, [revenueChannels]);

  const referrerRows = useMemo(() => {
    return (revenueReferrers ?? []).slice(0, 5).map(row => ({
      key: row.value,
      label: (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {row.value !== "direct" && <Favicon domain={row.value} className="w-3 h-3" />}
          <span className="truncate">{row.value === "direct" ? t("Direct") : row.value}</span>
        </span>
      ),
      primary: formatMoney(row.revenue_cents),
    }));
  }, [revenueReferrers, t]);

  const pageRows = useMemo(() => {
    return (pages?.data ?? []).slice(0, 5).map(row => ({
      key: row.value,
      label: <span className="truncate font-mono text-[11px]">{row.value || "/"}</span>,
      primary: row.count.toLocaleString(),
      secondary: `${round(row.percentage)}%`,
    }));
  }, [pages?.data]);

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top chrome */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-neutral-200 dark:border-neutral-800">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-850 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("Dashboard")}
        </Link>
        <span className="rounded-md border border-neutral-200 dark:border-neutral-800 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("Last 30 days")}
        </span>
      </div>

      {/* Bento — one viewport, no page scroll */}
      <div className="flex-1 min-h-0 p-2 md:p-3 grid grid-cols-12 grid-rows-[auto_1fr_1fr_auto] gap-2">
        {/* Hero identity */}
        <Panel className="col-span-12 md:col-span-4 row-span-1 md:row-span-2 flex flex-col items-center justify-center text-center gap-2 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-850">
            {domain ? (
              <Favicon domain={domain} className="h-8 w-8 rounded-sm" />
            ) : (
              <span className="text-xl font-semibold text-emerald-500">R</span>
            )}
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight">{siteName}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{period}</p>
            <p className="text-[10px] text-muted-foreground/70">{timezone}</p>
          </div>
          <div className="mt-1 grid w-full max-w-xs grid-cols-2 gap-2">
            <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-background px-2 py-2">
              <p className="text-[10px] text-muted-foreground">{t("Avg. daily visitors")}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">
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
            <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-2 py-2">
              <p className="text-[10px] text-muted-foreground">{t("Avg. daily revenue")}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-500 dark:text-emerald-400">
                {!REVENUE_ATTRIBUTION || revenueLoading ? "—" : formatMoneyPrecise(avgDailyRevenue)}
              </p>
            </div>
          </div>
        </Panel>

        {/* KPI strip */}
        <div className="col-span-12 md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Metric
            label={t("Visitors")}
            loading={overviewLoading}
            value={<NumberFlow value={visitors} format={{ notation: "compact" }} />}
          />
          <Metric
            label={t("Sessions")}
            loading={overviewLoading}
            value={<NumberFlow value={sessions} format={{ notation: "compact" }} />}
          />
          <Metric
            label={t("Revenue")}
            loading={revenueLoading}
            accent
            value={REVENUE_ATTRIBUTION ? formatMoney(revenueCents) : "—"}
          />
          <Metric
            label={t("Rev / visitor")}
            loading={revenueLoading || overviewLoading}
            accent
            value={REVENUE_ATTRIBUTION ? formatMoneyPrecise(revPerVisitor) : "—"}
          />
        </div>

        <div className="col-span-12 md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Metric
            label={t("Conversion rate")}
            loading={revenueLoading || overviewLoading}
            value={REVENUE_ATTRIBUTION ? `${conversionRate.toFixed(2)}%` : "—"}
          />
          <Metric
            label={t("Paying visitors")}
            loading={revenueLoading}
            value={REVENUE_ATTRIBUTION ? payingUsers.toLocaleString() : "—"}
          />
          <Metric label={t("Bounce rate")} loading={overviewLoading} value={`${Math.round(bounce)}%`} />
          <Metric
            label={t("Avg. session")}
            loading={overviewLoading}
            value={durationSec ? `${Math.round(durationSec / 60)}m ${Math.round(durationSec % 60)}s` : "—"}
          />
        </div>

        {/* Audience */}
        <Panel className="col-span-4 md:col-span-2">
          <PanelLabel>{t("Top device")}</PanelLabel>
          {topDevice ? (
            <div className="flex items-center gap-2 mt-1">
              <DeviceIcon deviceType={topDevice.value} size={22} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{topDevice.value}</p>
                <p className="text-[10px] text-muted-foreground">
                  {round(topDevice.percentage)}% {t("of sessions")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </Panel>
        <Panel className="col-span-4 md:col-span-2">
          <PanelLabel>{t("Top browser")}</PanelLabel>
          {topBrowser ? (
            <div className="flex items-center gap-2 mt-1">
              <Browser browser={topBrowser.value} size={22} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{topBrowser.value}</p>
                <p className="text-[10px] text-muted-foreground">
                  {round(topBrowser.percentage)}% {t("of sessions")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </Panel>
        <Panel className="col-span-4 md:col-span-2">
          <PanelLabel>{t("Top OS")}</PanelLabel>
          {topOs ? (
            <div className="flex items-center gap-2 mt-1">
              <OperatingSystem os={topOs.value} size={22} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{topOs.value}</p>
                <p className="text-[10px] text-muted-foreground">
                  {round(topOs.percentage)}% {t("of sessions")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </Panel>
        <Panel className="col-span-12 md:col-span-2 flex flex-col justify-center">
          <PanelLabel>{t("Conversion rate")}</PanelLabel>
          <p className="text-2xl font-semibold tabular-nums text-emerald-500 dark:text-emerald-400">
            {REVENUE_ATTRIBUTION ? `${conversionRate.toFixed(2)}%` : "—"}
          </p>
        </Panel>

        {/* Rankings */}
        <div className="col-span-12 md:col-span-3 min-h-0">
          <RankList
            title={t("Top revenue by country")}
            loading={revCountriesLoading}
            empty={t("No revenue in this period")}
            rows={countryRows}
          />
        </div>
        <div className="col-span-12 md:col-span-3 min-h-0">
          <RankList
            title={t("Top revenue by channel")}
            loading={revChannelsLoading}
            empty={t("No revenue in this period")}
            rows={channelRows}
          />
        </div>
        <div className="col-span-12 md:col-span-3 min-h-0">
          <RankList
            title={t("Top revenue by referrer")}
            loading={revReferrersLoading}
            empty={t("No revenue in this period")}
            rows={referrerRows}
          />
        </div>
        <div className="col-span-12 md:col-span-3 min-h-0">
          <RankList title={t("Top pages")} loading={false} empty={t("No pageviews yet")} rows={pageRows} />
        </div>

        {REVENUE_ATTRIBUTION && paymentCount > 0 && (
          <p className="col-span-12 text-center text-[10px] text-muted-foreground pb-1">
            {paymentCount.toLocaleString()} {t("successful payments")} · {payingUsers.toLocaleString()}{" "}
            {t("paying visitors")} · {t("conversion")} {conversionRate.toFixed(2)}%
            {topDeviceRev && (
              <>
                {" "}
                · {round(topDeviceRev.pct)}% {t("sessions on")} {topDeviceRev.name}
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
