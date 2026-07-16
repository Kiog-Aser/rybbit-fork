"use client";

/**
 * Insights — DataFast-style full-screen report for the last 30 days.
 * Layout mirrors DataFast's bento (center identity, left revenue-share cards,
 * right acquisition/conversion) while using Rybbit design tokens only:
 * tight radii, flat surfaces, emerald accent, periwinkle dataviz.
 */

import NumberFlow from "@number-flow/react";
import { ResponsiveLine } from "@nivo/line";
import { ArrowLeft, Globe2, Wallet } from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { useGetOverview } from "../../../api/analytics/hooks/useGetOverview";
import { useGetOverviewBucketed } from "../../../api/analytics/hooks/useGetOverviewBucketed";
import { usePaginatedMetric } from "../../../api/analytics/hooks/useGetMetric";
import { useCurrentSite } from "../../../api/admin/hooks/useSites";
import { useRevenueByDimension, useRevenueOverview, useRevenueTimeSeries } from "../../../api/revenue/hooks";
import { Time } from "../../../components/DateSelector/types";
import { Favicon } from "../../../components/Favicon";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { useNivoTheme } from "../../../lib/nivo";
import { REVENUE_ATTRIBUTION } from "../../../lib/const";
import { getMainDashboardPath } from "../../../lib/siteRoute";
import { getTimezone, useStore } from "../../../lib/store";
import { cn, getCountryName } from "../../../lib/utils";
import { CountryFlag } from "../components/shared/icons/CountryFlag";
import { Browser } from "../components/shared/icons/Browser";
import { DeviceIcon } from "../components/shared/icons/Device";
import { OperatingSystem } from "../components/shared/icons/OperatingSystem";

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

function money(cents: number, precise = false) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: precise ? 2 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  });
}

function pct(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 min-h-0 overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-medium uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** "93% revenue from Desktop ($6.7k)" style insight card */
function RevenueShareCard({
  icon,
  headline,
  amountCents,
  sharePct,
  subline,
}: {
  icon: React.ReactNode;
  headline: string;
  amountCents: number;
  sharePct: number;
  subline?: string;
}) {
  return (
    <Panel className="p-3 flex gap-3 items-start">
      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-background">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-foreground">
          {pct(sharePct)} {headline}{" "}
          <span className="text-muted-foreground font-medium">({money(amountCents)})</span>
        </p>
        {subline && <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{subline}</p>}
      </div>
    </Panel>
  );
}

function RankColumn({
  title,
  rows,
  empty,
  valueAccent,
}: {
  title: string;
  empty: string;
  valueAccent?: boolean;
  rows: Array<{ key: string; label: React.ReactNode; value: string }>;
}) {
  return (
    <div className="min-h-0 flex flex-col p-3">
      <Label className="mb-2">{title}</Label>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">{empty}</p>
      ) : (
        <div className="flex flex-col gap-1.5 min-h-0 overflow-hidden">
          {rows.map(r => (
            <div key={r.key} className="flex items-center justify-between gap-2 text-xs min-w-0">
              <div className="min-w-0 truncate">{r.label}</div>
              <span
                className={cn(
                  "tabular-nums shrink-0 font-medium",
                  valueAccent ? "text-emerald-500 dark:text-emerald-400" : "text-foreground"
                )}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBarChart({
  items,
  empty,
}: {
  items: Array<{ label: string; value: number }>;
  empty: string;
}) {
  const max = Math.max(1, ...items.map(i => i.value));
  if (!items.some(i => i.value > 0)) {
    return <p className="text-[11px] text-muted-foreground py-6 text-center">{empty}</p>;
  }
  return (
    <div className="flex items-end gap-1 h-16 w-full px-1">
      {items.map(item => (
        <div key={item.label} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end">
          <div
            className="w-full max-w-[18px] mx-auto rounded-sm bg-emerald-500/70 dark:bg-emerald-500/60"
            style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
            title={`${item.label}: ${item.value}`}
          />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Heatmap({
  cells,
  peakLabel,
}: {
  cells: number[][]; // 7 days x 6 buckets (4h)
  peakLabel?: string;
}) {
  const max = Math.max(1, ...cells.flat());
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="flex flex-col gap-1.5 h-full">
      <div className="grid grid-cols-7 gap-0.5 flex-1 content-start">
        {days.map((d, di) => (
          <div key={d} className="flex flex-col gap-0.5">
            {cells[di]?.map((v, hi) => (
              <div
                key={hi}
                className="aspect-square rounded-[2px]"
                style={{
                  backgroundColor:
                    v <= 0
                      ? "rgba(255,255,255,0.04)"
                      : `rgba(16, 185, 129, ${0.15 + (v / max) * 0.85})`,
                }}
                title={`${d} bucket ${hi + 1}: ${v}`}
              />
            ))}
          </div>
        ))}
      </div>
      {peakLabel && <p className="text-[10px] text-muted-foreground leading-snug">{peakLabel}</p>}
    </div>
  );
}

export default function InsightsPage() {
  const t = useExtracted();
  const pathname = usePathname();
  const last30 = useLast30Days();
  const siteId = useStore(s => s.site);
  const { site } = useCurrentSite();
  const nivoTheme = useNivoTheme();

  const { data: overview, isLoading: overviewLoading } = useGetOverview({
    site: siteId,
    overrideTime: last30,
    useFilters: false,
    lite: true,
  });
  const { data: bucketed } = useGetOverviewBucketed({
    site: siteId,
    bucket: "day",
    overrideTime: last30,
    useFilters: false,
    lite: true,
  });
  const { data: revenue } = useRevenueOverview(last30);
  const { data: revSeries } = useRevenueTimeSeries(last30, "day");

  const { data: revDevices } = useRevenueByDimension("device_type", last30);
  const { data: revOs } = useRevenueByDimension("operating_system", last30);
  const { data: revBrowsers } = useRevenueByDimension("browser", last30);
  const { data: revCountries } = useRevenueByDimension("country", last30);
  const { data: revReferrers } = useRevenueByDimension("referrer", last30);

  const { data: devices } = usePaginatedMetric({
    parameter: "device_type",
    limit: 10,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });
  const { data: systems } = usePaginatedMetric({
    parameter: "operating_system",
    limit: 10,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });
  const { data: browsers } = usePaginatedMetric({
    parameter: "browser",
    limit: 10,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });
  const { data: countries } = usePaginatedMetric({
    parameter: "country",
    limit: 20,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });
  const { data: referrers } = usePaginatedMetric({
    parameter: "referrer",
    limit: 20,
    page: 1,
    lite: true,
    useFilters: false,
    customTime: last30,
  });

  useSetPageTitle(t("Insights"));

  const days = 30;
  const visitors = overview?.data?.users ?? 0;
  const revenueCents = revenue?.totals.revenue_cents ?? 0;
  const paymentCount = revenue?.totals.payment_count ?? 0;
  const payingUsers = revenue?.totals.paying_users ?? 0;
  const buyers = payingUsers > 0 ? payingUsers : paymentCount;
  const avgDailyVisitors = visitors / days;
  const avgDailyRevenue = revenueCents / days;
  const revPerVisitor = visitors > 0 ? revenueCents / visitors : 0;
  const conversionRate = visitors > 0 ? (buyers / visitors) * 100 : 0;

  const domain = site?.domain ?? "";
  const siteName = site?.name || domain || t("Your site");
  const periodLabel = t("last 30 days");
  const backHref = getMainDashboardPath(pathname) ?? "/";

  const totalRev = Math.max(1, revenueCents);

  // —— Left insight cards: revenue share by device / OS / browser ——
  const deviceShare = useMemo(() => {
    const rows = revDevices ?? [];
    if (rows.length === 0) {
      // Fall back to session share when Stripe payments lack session attribution
      const top = devices?.data?.[0];
      const second = devices?.data?.[1];
      if (!top) return null;
      return {
        value: top.value,
        share: top.percentage,
        amount: 0,
        sub: second ? `${Math.round(second.percentage)}% ${t("from")} ${second.value}` : undefined,
        fallback: true,
      };
    }
    const top = rows[0];
    const rest = rows
      .slice(1, 3)
      .map(r => `${Math.round((r.revenue_cents / totalRev) * 100)}% ${t("from")} ${r.value}`)
      .join(", ");
    return {
      value: top.value,
      share: (top.revenue_cents / totalRev) * 100,
      amount: top.revenue_cents,
      sub: rest || undefined,
      fallback: false,
    };
  }, [revDevices, devices?.data, totalRev, t]);

  const osShare = useMemo(() => {
    const rows = revOs ?? [];
    if (rows.length === 0) {
      const top = systems?.data?.[0];
      const others = (systems?.data ?? []).slice(1, 3);
      if (!top) return null;
      return {
        value: top.value,
        share: top.percentage,
        amount: 0,
        sub: others.map(o => `${Math.round(o.percentage)}% ${t("from")} ${o.value}`).join(", ") || undefined,
        fallback: true,
      };
    }
    const top = rows[0];
    const rest = rows
      .slice(1, 3)
      .map(r => `${Math.round((r.revenue_cents / totalRev) * 100)}% ${t("from")} ${r.value}`)
      .join(", ");
    return {
      value: top.value,
      share: (top.revenue_cents / totalRev) * 100,
      amount: top.revenue_cents,
      sub: rest || undefined,
      fallback: false,
    };
  }, [revOs, systems?.data, totalRev, t]);

  const browserShare = useMemo(() => {
    const rows = revBrowsers ?? [];
    if (rows.length === 0) {
      const top = browsers?.data?.[0];
      const others = (browsers?.data ?? []).slice(1, 3);
      if (!top) return null;
      return {
        value: top.value,
        share: top.percentage,
        amount: 0,
        sub: others.map(o => `${Math.round(o.percentage)}% ${t("from")} ${o.value}`).join(", ") || undefined,
        fallback: true,
      };
    }
    const top = rows[0];
    const rest = rows
      .slice(1, 3)
      .map(r => `${Math.round((r.revenue_cents / totalRev) * 100)}% ${t("from")} ${r.value}`)
      .join(", ");
    return {
      value: top.value,
      share: (top.revenue_cents / totalRev) * 100,
      amount: top.revenue_cents,
      sub: rest || undefined,
      fallback: false,
    };
  }, [revBrowsers, browsers?.data, totalRev, t]);

  // —— Countries: top revenue + top conversion (payments / visitors) ——
  const countryRevenueRows = useMemo(() => {
    return (revCountries ?? []).slice(0, 5).map(r => ({
      key: r.value,
      label: (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <CountryFlag country={r.value} />
          <span className="truncate">{getCountryName(r.value) || r.value}</span>
        </span>
      ),
      value: money(r.revenue_cents),
    }));
  }, [revCountries]);

  const countryConversionRows = useMemo(() => {
    const revMap = new Map((revCountries ?? []).map(r => [r.value, r.payment_count]));
    const rows = (countries?.data ?? [])
      .map(c => {
        const payments = revMap.get(c.value) ?? 0;
        const rate = c.count > 0 ? (payments / c.count) * 100 : 0;
        return { value: c.value, rate, payments };
      })
      .filter(r => r.payments > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    // If no attributed revenue by country, show top countries by visitors as weak signal
    if (rows.length === 0) {
      return (countries?.data ?? []).slice(0, 5).map(c => ({
        key: c.value,
        label: (
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <CountryFlag country={c.value} />
            <span className="truncate">{getCountryName(c.value) || c.value}</span>
          </span>
        ),
        value: pct(c.percentage, 1),
      }));
    }
    return rows.map(r => ({
      key: r.value,
      label: (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <CountryFlag country={r.value} />
          <span className="truncate">{getCountryName(r.value) || r.value}</span>
        </span>
      ),
      value: pct(r.rate, 2),
    }));
  }, [revCountries, countries?.data]);

  // —— Referrers: top revenue + top conversion ——
  const referrerRevenueRows = useMemo(() => {
    return (revReferrers ?? []).slice(0, 5).map(r => ({
      key: r.value,
      label: (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {r.value !== "direct" && <Favicon domain={r.value} className="w-3 h-3" />}
          <span className="truncate">{r.value === "direct" ? t("Direct") : r.value}</span>
        </span>
      ),
      value: money(r.revenue_cents),
    }));
  }, [revReferrers, t]);

  const referrerConversionRows = useMemo(() => {
    const revMap = new Map((revReferrers ?? []).map(r => [r.value, r.payment_count]));
    const rows = (referrers?.data ?? [])
      .map(c => {
        const payments = revMap.get(c.value) ?? 0;
        const rate = c.count > 0 ? (payments / c.count) * 100 : 0;
        return { value: c.value, rate, payments };
      })
      .filter(r => r.payments > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    if (rows.length === 0) {
      return (referrers?.data ?? []).slice(0, 5).map(c => ({
        key: c.value,
        label: (
          <span className="inline-flex items-center gap-1.5 min-w-0">
            {c.value !== "Direct" && c.value !== "direct" && <Favicon domain={c.value} className="w-3 h-3" />}
            <span className="truncate">{c.value}</span>
          </span>
        ),
        value: pct(c.percentage, 1),
      }));
    }
    return rows.map(r => ({
      key: r.value,
      label: (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {r.value !== "direct" && <Favicon domain={r.value} className="w-3 h-3" />}
          <span className="truncate">{r.value === "direct" ? t("Direct") : r.value}</span>
        </span>
      ),
      value: pct(r.rate, 2),
    }));
  }, [revReferrers, referrers?.data, t]);

  // —— Rev / visitor growth line (daily) ——
  const revPerVisitorSeries = useMemo(() => {
    const visitorsByDay = new Map<string, number>();
    for (const row of bucketed?.data ?? []) {
      const day = DateTime.fromSQL(row.time).toISODate() ?? row.time.slice(0, 10);
      visitorsByDay.set(day, (visitorsByDay.get(day) ?? 0) + (row.users ?? 0));
    }
    const revByDay = new Map<string, number>();
    for (const row of revSeries ?? []) {
      const day = DateTime.fromISO(row.time).toISODate() ?? row.time.slice(0, 10);
      revByDay.set(day, (revByDay.get(day) ?? 0) + row.revenue_cents);
    }
    const daysKeys = [...new Set([...visitorsByDay.keys(), ...revByDay.keys()])].sort();
    return daysKeys.map(day => {
      const v = visitorsByDay.get(day) ?? 0;
      const r = revByDay.get(day) ?? 0;
      return {
        x: day,
        y: v > 0 ? r / 100 / v : 0,
      };
    });
  }, [bucketed?.data, revSeries]);

  // —— Purchase timing from payment timestamps (works without session link) ——
  const purchaseHeatmap = useMemo(() => {
    // 7 days × 6 four-hour buckets; filled from revenue series if we only have day buckets
    // Without hour-level payment data in the client series, derive a soft heatmap from daily payments.
    const cells: number[][] = Array.from({ length: 7 }, () => Array(6).fill(0));
    let peak = { dow: 0, bucket: 0, value: 0 };
    for (const row of revSeries ?? []) {
      const dt = DateTime.fromISO(row.time);
      if (!dt.isValid) continue;
      // luxon weekday 1=Mon..7=Sun → 0..6
      const dow = dt.weekday - 1;
      const bucket = Math.min(5, Math.floor(dt.hour / 4));
      cells[dow][bucket] += row.payment_count;
      if (cells[dow][bucket] > peak.value) {
        peak = { dow, bucket, value: cells[dow][bucket] };
      }
    }
    const dayNames = [
      t("Monday"),
      t("Tuesday"),
      t("Wednesday"),
      t("Thursday"),
      t("Friday"),
      t("Saturday"),
      t("Sunday"),
    ];
    const hourStart = peak.bucket * 4;
    const peakLabel =
      peak.value > 0
        ? t("Conversion peak on {day} around {hour}", {
            day: dayNames[peak.dow],
            hour: `${hourStart}:00`,
          })
        : undefined;
    return { cells, peakLabel };
  }, [revSeries, t]);

  // Days-to-purchase buckets — without session attribution we show empty chart
  const daysToPurchase = useMemo(
    () => [
      { label: "24h", value: 0 },
      { label: "1d", value: 0 },
      { label: "2d", value: 0 },
      { label: "3d", value: 0 },
      { label: "1w", value: 0 },
      { label: "2w", value: 0 },
      { label: "1m+", value: 0 },
    ],
    []
  );

  // Visits-to-purchase — needs session-linked payments
  const visitsToPurchase = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        label: i === 9 ? "10+" : String(i + 1),
        value: 0,
      })),
    []
  );

  const firstVisitPct = paymentCount > 0 ? 0 : 0; // unknown without session attribution

  const shareHeadline = (kind: "device" | "os" | "browser", value: string, fallback: boolean) => {
    if (fallback) {
      if (kind === "device") return t("of sessions on {value}", { value });
      if (kind === "os") return t("of sessions on {value}", { value });
      return t("of sessions in {value}", { value });
    }
    if (kind === "device") return t("revenue from {value}", { value });
    if (kind === "os") return t("revenue from {value} users", { value });
    return t("revenue from {value} users", { value });
  };

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden">
      {/* Minimal chrome */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("Dashboard")}
        </Link>
        <span className="rounded-md border border-neutral-200 dark:border-neutral-800 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("Last 30 days")}
        </span>
      </div>

      {/*
        DataFast-style 3-column bento:
        left = revenue-share insights + countries
        center = identity + averages + rev/visitor
        right = acquisition + conversion + events/heatmap
      */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 p-2 pt-0 overflow-hidden">
        {/* ── LEFT ── */}
        <div className="lg:col-span-3 min-h-0 flex flex-col gap-2 overflow-hidden">
          {deviceShare ? (
            <RevenueShareCard
              icon={<DeviceIcon deviceType={deviceShare.value} size={22} />}
              headline={shareHeadline("device", deviceShare.value, deviceShare.fallback)}
              amountCents={deviceShare.amount}
              sharePct={deviceShare.share}
              subline={deviceShare.sub}
            />
          ) : (
            <Panel className="p-3 text-xs text-muted-foreground">{t("No device data")}</Panel>
          )}
          {osShare ? (
            <RevenueShareCard
              icon={<OperatingSystem os={osShare.value} size={22} />}
              headline={shareHeadline("os", osShare.value, osShare.fallback)}
              amountCents={osShare.amount}
              sharePct={osShare.share}
              subline={osShare.sub}
            />
          ) : (
            <Panel className="p-3 text-xs text-muted-foreground">{t("No OS data")}</Panel>
          )}
          {browserShare ? (
            <RevenueShareCard
              icon={<Browser browser={browserShare.value} size={22} />}
              headline={shareHeadline("browser", browserShare.value, browserShare.fallback)}
              amountCents={browserShare.amount}
              sharePct={browserShare.share}
              subline={browserShare.sub}
            />
          ) : (
            <Panel className="p-3 text-xs text-muted-foreground">{t("No browser data")}</Panel>
          )}

          {/* First visit + visits to purchase */}
          <div className="grid grid-cols-5 gap-2 min-h-0 flex-1">
            <Panel className="col-span-2 p-3 flex flex-col justify-center">
              <p className="text-3xl font-semibold tabular-nums text-emerald-500 dark:text-emerald-400">
                {pct(firstVisitPct)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                {t("of buyers purchase on first visit")}
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground/70">
                {t("Needs Stripe session attribution")}
              </p>
            </Panel>
            <Panel className="col-span-3 p-3 flex flex-col">
              <Label className="mb-2">{t("Visits to purchase")}</Label>
              <div className="flex-1 min-h-0">
                <MiniBarChart items={visitsToPurchase} empty={t("Link payments to sessions to unlock")} />
              </div>
            </Panel>
          </div>

          {/* Countries */}
          <Panel className="grid grid-cols-2 min-h-[120px]">
            <RankColumn
              title={t("Top revenue")}
              empty={t("No revenue in this period")}
              valueAccent
              rows={countryRevenueRows}
            />
            <div className="border-l border-neutral-200 dark:border-neutral-800">
              <RankColumn
                title={t("Top conversion")}
                empty={t("No conversions yet")}
                rows={countryConversionRows}
              />
            </div>
          </Panel>
        </div>

        {/* ── CENTER ── */}
        <div className="lg:col-span-5 min-h-0 flex flex-col gap-2 overflow-hidden">
          {/* Avg daily metrics */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <Panel className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-background">
                <Globe2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums leading-none">
                  {overviewLoading ? "—" : <NumberFlow value={Math.round(avgDailyVisitors)} />}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t("avg. daily visitors")}</p>
              </div>
            </Panel>
            <Panel className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-background">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums leading-none text-emerald-500 dark:text-emerald-400">
                  {REVENUE_ATTRIBUTION ? money(avgDailyRevenue, true) : "—"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t("avg. daily revenue")}</p>
              </div>
            </Panel>
          </div>

          {/* Identity hero */}
          <Panel className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4 py-6 relative">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.06),transparent_65%)]" />
            <div className="relative flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-background shadow-none">
                {domain ? (
                  <Favicon domain={domain} className="h-11 w-11 rounded-sm" />
                ) : (
                  <span className="text-2xl font-semibold text-emerald-500">R</span>
                )}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{domain || siteName}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
              </div>
            </div>
          </Panel>

          {/* Rev / visitor growth + big number */}
          <Panel className="p-3 flex flex-col gap-2 shrink-0 h-[180px]">
            <Label>{t("Rev / visitor growth")}</Label>
            <div className="flex-1 min-h-0">
              {revPerVisitorSeries.length > 1 ? (
                <ResponsiveLine
                  data={[{ id: "rpv", data: revPerVisitorSeries }]}
                  theme={nivoTheme}
                  margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  xScale={{ type: "point" }}
                  yScale={{ type: "linear", min: 0, max: "auto" }}
                  enableGridX={false}
                  enableGridY={false}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={null}
                  axisLeft={null}
                  enablePoints={false}
                  enableArea
                  areaOpacity={0.12}
                  curve="monotoneX"
                  colors={["#10b981"]}
                  animate={false}
                  isInteractive
                  useMesh
                  enableSlices="x"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  {t("Not enough data yet")}
                </div>
              )}
            </div>
            <p className="text-3xl font-semibold tabular-nums text-emerald-500 dark:text-emerald-400 text-center">
              {money(revPerVisitor, true)}
            </p>
            <p className="text-[11px] text-muted-foreground text-center -mt-1">{t("revenue per visitor")}</p>
          </Panel>
        </div>

        {/* ── RIGHT ── */}
        <div className="lg:col-span-4 min-h-0 flex flex-col gap-2 overflow-hidden">
          {/* Top revenue / conversion referrers */}
          <Panel className="grid grid-cols-2 min-h-[140px] shrink-0">
            <RankColumn
              title={t("Top revenue")}
              empty={t("No revenue in this period")}
              valueAccent
              rows={referrerRevenueRows}
            />
            <div className="border-l border-neutral-200 dark:border-neutral-800">
              <RankColumn
                title={t("Top conversion")}
                empty={t("No conversions yet")}
                rows={referrerConversionRows}
              />
            </div>
          </Panel>

          {/* Days to purchase + median */}
          <div className="grid grid-cols-5 gap-2 shrink-0">
            <Panel className="col-span-3 p-3">
              <Label className="mb-2">{t("Days to purchase")}</Label>
              <MiniBarChart items={daysToPurchase} empty={t("Link payments to sessions to unlock")} />
            </Panel>
            <Panel className="col-span-2 p-3 flex flex-col justify-center items-center text-center">
              <p className="text-3xl font-semibold tabular-nums text-emerald-500 dark:text-emerald-400">—</p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                {t("hours median to purchase")}
              </p>
            </Panel>
          </div>

          {/* Big conversion rate */}
          <Panel className="p-4 flex flex-col items-center justify-center shrink-0">
            <p className="text-4xl font-semibold tabular-nums text-emerald-500 dark:text-emerald-400">
              {pct(conversionRate, 2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("conversion rate")}</p>
          </Panel>

          {/* Events + heatmap */}
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
            <Panel className="p-3 flex flex-col min-h-0">
              <Label className="mb-2">{t("Top converting events")}</Label>
              <p className="text-[11px] text-muted-foreground flex-1 flex items-center justify-center text-center px-2">
                {t("Event → purchase funnels unlock with session-linked payments")}
              </p>
            </Panel>
            <Panel className="p-3 flex flex-col min-h-0">
              <Heatmap cells={purchaseHeatmap.cells} peakLabel={purchaseHeatmap.peakLabel} />
            </Panel>
          </div>
        </div>
      </div>

      {/* Footer strip */}
      {REVENUE_ATTRIBUTION && paymentCount > 0 && (
        <p className="shrink-0 text-center text-[10px] text-muted-foreground pb-2 px-3">
          {paymentCount.toLocaleString()} {t("successful payments")} · {buyers.toLocaleString()}{" "}
          {t("paying visitors")} · {t("conversion")} {pct(conversionRate, 2)}
        </p>
      )}
    </div>
  );
}
