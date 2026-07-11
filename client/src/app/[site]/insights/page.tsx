"use client";

import { DollarSign, MousePointerClick, Users, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useGetOverview } from "../../../api/analytics/hooks/useGetOverview";
import { useRevenueOverview } from "../../../api/revenue/hooks";
import { Card, CardContent } from "../../../components/ui/card";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { REVENUE_ATTRIBUTION } from "../../../lib/const";
import { SubHeader } from "../components/SubHeader/SubHeader";
import { CountriesLite } from "../main/components/sections/CountriesLite";
import { CrawlersLite } from "../main/components/sections/CrawlersLite";
import { DevicesLite } from "../main/components/sections/DevicesLite";
import { PagesLite } from "../main/components/sections/PagesLite";
import { ReferrersLite } from "../main/components/sections/ReferrersLite";

function InsightMetric({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <p className={accent ? "mt-3 text-2xl font-semibold text-accent-400" : "mt-3 text-2xl font-semibold"}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const t = useExtracted();
  const { data: overview } = useGetOverview({});
  const { data: revenue } = useRevenueOverview();
  useSetPageTitle(t("Insights"));

  const revenueValue = revenue
    ? `$${(revenue.totals.revenue_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : "—";
  const visitorCount = overview?.data?.users ?? 0;
  const averageRevenue =
    revenue && visitorCount ? "$" + (revenue.totals.revenue_cents / 100 / visitorCount).toFixed(2) : "—";
  const duration = overview?.data?.session_duration ? `${Math.round(overview.data.session_duration / 60)}m` : "—";

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-2 md:p-4">
      <SubHeader />
      <div className="px-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Insights")}</p>
        <h1 className="mt-1 text-xl font-semibold">{t("What is happening on your site")}</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InsightMetric label={t("Visitors")} value={overview?.data?.users?.toLocaleString() ?? "—"} icon={Users} />
        <InsightMetric
          label={t("Sessions")}
          value={overview?.data?.sessions?.toLocaleString() ?? "—"}
          icon={MousePointerClick}
        />
        <InsightMetric label={t("Avg. stay")} value={duration} icon={WalletCards} />
        <InsightMetric label={t("Revenue")} value={REVENUE_ATTRIBUTION ? revenueValue : "—"} icon={DollarSign} accent />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ReferrersLite />
        <PagesLite />
        <CountriesLite />
        <DevicesLite />
        <CrawlersLite />
        {REVENUE_ATTRIBUTION && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{t("Revenue efficiency")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("Revenue per visitor in this period")}</p>
                </div>
                <DollarSign className="h-4 w-4 text-accent-400" />
              </div>
              <p className="mt-8 text-3xl font-semibold text-accent-400">{averageRevenue}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {revenue?.totals.paying_users ?? 0} {t("paying visitors")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
