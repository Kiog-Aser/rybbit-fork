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
import { getCountryName } from "../../../lib/utils";
import { CountryFlag } from "../components/shared/icons/CountryFlag";
import { Browser } from "../components/shared/icons/Browser";
import { DeviceIcon } from "../components/shared/icons/Device";
import { OperatingSystem } from "../components/shared/icons/OperatingSystem";

/** Insights is always a rolling last-30-days report — independent of dashboard date filter. */
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

function StatPill({
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24 bg-white/10" />
      ) : (
        <div className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${accent ? "text-emerald-400" : "text-white"}`}>
          {value}
        </div>
      )}
    </div>
  );
}

function RankBlock({
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 h-full">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 mb-4">{title}</p>
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full bg-white/10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500 py-8 text-center">{empty}</p>
      ) : (
        <div className="space-y-1">
          {rows.map((row, i) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 text-sm py-2 border-b border-white/[0.04] last:border-0"
            >
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <span className="text-[11px] tabular-nums text-neutral-600 w-4 shrink-0">{i + 1}</span>
                <div className="min-w-0 truncate text-neutral-200">{row.label}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                {row.secondary && <span className="text-xs text-neutral-500">{row.secondary}</span>}
                <span className="font-medium text-emerald-400/90 min-w-[3.5rem] text-right">{row.primary}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const t = useExtracted();
  const pathname = usePathname();
  const last30 = useLast30Days();
  const siteId = useStore(s => s.site);
  const { site } = useCurrentSite();

  const { data: overview, isLoading: overviewLoading } = useGetOverview({
    site: siteId,
    overrideTime: last30,
    useFilters: false,
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
      secondary: `${row.payment_count}`,
    }));
  }, [revenueCountries]);

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
      label: <span className="truncate font-mono text-xs text-neutral-300">{row.value || "/"}</span>,
      primary: row.count.toLocaleString(),
      secondary: `${round(row.percentage)}%`,
    }));
  }, [pages?.data]);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-neutral-950 text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,rgb(10,10,10)_75%)]" />
      </div>

      {/* Minimal top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("Dashboard")}
        </Link>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-400">
          {t("Last 30 days")}
        </span>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[880px] space-y-8 px-4 pb-20 pt-6 md:px-6 md:pt-10">
        {/* Hero — centered report identity */}
        <section className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/[0.1] bg-gradient-to-b from-white/[0.08] to-white/[0.02] shadow-2xl shadow-black/50">
            {domain ? (
              <Favicon domain={domain} className="h-11 w-11 rounded-xl" />
            ) : (
              <span className="text-3xl font-semibold text-emerald-400">R</span>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{siteName}</h1>
          <p className="mt-2 text-sm text-neutral-400">{period}</p>
          <p className="mt-0.5 text-[11px] text-neutral-600">{timezone}</p>

          <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">
                {t("Avg. daily visitors")}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
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
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">
                {t("Avg. daily revenue")}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-emerald-400">
                {!REVENUE_ATTRIBUTION || revenueLoading ? "—" : formatMoneyPrecise(avgDailyRevenue)}
              </p>
            </div>
          </div>
        </section>

        {/* KPI grid */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatPill
            label={t("Visitors")}
            loading={overviewLoading}
            value={<NumberFlow value={visitors} format={{ notation: "compact" }} />}
          />
          <StatPill
            label={t("Sessions")}
            loading={overviewLoading}
            value={<NumberFlow value={sessions} format={{ notation: "compact" }} />}
          />
          <StatPill
            label={t("Revenue")}
            loading={revenueLoading}
            accent
            value={REVENUE_ATTRIBUTION ? formatMoney(revenueCents) : "—"}
          />
          <StatPill
            label={t("Rev / visitor")}
            loading={revenueLoading || overviewLoading}
            accent
            value={REVENUE_ATTRIBUTION ? formatMoneyPrecise(revPerVisitor) : "—"}
          />
          <StatPill
            label={t("Conversion rate")}
            loading={revenueLoading || overviewLoading}
            value={REVENUE_ATTRIBUTION ? `${conversionRate.toFixed(2)}%` : "—"}
          />
          <StatPill
            label={t("Paying visitors")}
            loading={revenueLoading}
            value={REVENUE_ATTRIBUTION ? payingUsers.toLocaleString() : "—"}
          />
          <StatPill label={t("Bounce rate")} loading={overviewLoading} value={`${Math.round(bounce)}%`} />
          <StatPill
            label={t("Avg. session")}
            loading={overviewLoading}
            value={durationSec ? `${Math.round(durationSec / 60)}m ${Math.round(durationSec % 60)}s` : "—"}
          />
        </section>

        {/* Audience composition */}
        <section className="grid gap-3 md:grid-cols-3">
          <AudienceCard
            title={t("Top device")}
            icon={topDevice ? <DeviceIcon deviceType={topDevice.value} size={28} /> : null}
            name={topDevice?.value || t("Unknown")}
            pct={topDevice ? round(topDevice.percentage) : null}
            suffix={t("of sessions")}
          />
          <AudienceCard
            title={t("Top browser")}
            icon={topBrowser ? <Browser browser={topBrowser.value} size={28} /> : null}
            name={topBrowser?.value || t("Unknown")}
            pct={topBrowser ? round(topBrowser.percentage) : null}
            suffix={t("of sessions")}
          />
          <AudienceCard
            title={t("Top OS")}
            icon={topOs ? <OperatingSystem os={topOs.value} size={28} /> : null}
            name={topOs?.value || t("Unknown")}
            pct={topOs ? round(topOs.percentage) : null}
            suffix={t("of sessions")}
          />
        </section>

        {/* Breakdowns */}
        <section className="grid gap-3 lg:grid-cols-2">
          <RankBlock
            title={t("Top revenue by country")}
            loading={revCountriesLoading}
            empty={t("No revenue in this period")}
            rows={countryRows}
          />
          <RankBlock
            title={t("Top revenue by channel")}
            loading={revChannelsLoading}
            empty={t("No revenue in this period")}
            rows={channelRows}
          />
          <RankBlock
            title={t("Top revenue by referrer")}
            loading={revReferrersLoading}
            empty={t("No revenue in this period")}
            rows={referrerRows}
          />
          <RankBlock title={t("Top pages")} loading={false} empty={t("No pageviews yet")} rows={pageRows} />
        </section>

        {REVENUE_ATTRIBUTION && paymentCount > 0 && (
          <p className="text-center text-xs text-neutral-600">
            {paymentCount.toLocaleString()} {t("successful payments")} · {payingUsers.toLocaleString()}{" "}
            {t("paying visitors")} · {t("conversion")} {conversionRate.toFixed(2)}%
          </p>
        )}
      </div>
    </div>
  );
}

function AudienceCard({
  title,
  icon,
  name,
  pct,
  suffix,
}: {
  title: string;
  icon: React.ReactNode;
  name: string;
  pct: number | null;
  suffix: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 mb-3">{title}</p>
      {pct != null ? (
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="font-semibold text-neutral-100">{name}</p>
            <p className="text-xs text-neutral-500">
              {pct}% {suffix}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">—</p>
      )}
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
