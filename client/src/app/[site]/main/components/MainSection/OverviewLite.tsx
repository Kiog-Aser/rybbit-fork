"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatSecondsAsMinutesAndSeconds } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useGetLiveUserCount } from "../../../../../api/analytics/hooks/useGetLiveUserCount";
import { useGetOverview } from "../../../../../api/analytics/hooks/useGetOverview";
import { useGetOverviewBucketed } from "../../../../../api/analytics/hooks/useGetOverviewBucketed";
import type { GetOverviewBucketedResponse } from "../../../../../api/analytics/endpoints";
import { useRevenueOverview, useStripeRevenueStatus } from "../../../../../api/revenue/hooks";
import { REVENUE_ATTRIBUTION } from "../../../../../lib/const";
import { StatType, useStore } from "../../../../../lib/store";
import { SparklinesChart } from "./SparklinesChart";

type LiteStatType = StatType | "revenue" | "conversion_rate" | "revenue_per_visitor" | "online";

const formatRevenue = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatRevenuePrecise = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Stat = ({
  title,
  id,
  value,
  valueFormatter,
  getBucketValue,
  isLoading,
  decimals,
  postfix,
  selectable = true,
  accent,
  trailing,
}: {
  title: string;
  id: LiteStatType;
  value: number;
  valueFormatter?: (value: number) => string;
  getBucketValue?: (bucket: GetOverviewBucketedResponse[number]) => number;
  isLoading: boolean;
  decimals?: number;
  postfix?: string;
  selectable?: boolean;
  accent?: string;
  trailing?: React.ReactNode;
}) => {
  const { selectedStat, setSelectedStat, site, bucket, time } = useStore();
  const [isHovering, setIsHovering] = useState(false);
  const isSelectable = selectable && id !== "online";

  const { data } = useGetOverviewBucketed({ site, bucket, lite: true });

  const sparklinesData =
    data?.data
      ?.filter(d => {
        if (time.mode === "past-minutes") {
          const timestamp = new Date(d.time);
          const now = new Date();
          const startTime = new Date(now.getTime() - time.pastMinutesStart * 60 * 1000);
          return timestamp >= startTime && timestamp <= now;
        }
        return true;
      })
      .map(d => ({
        value: getBucketValue ? getBucketValue(d) : (d[id as StatType] ?? 0),
        time: d.time,
      })) ?? [];

  const handleClick = () => {
    if (isSelectable && (id === "users" || id === "bounce_rate" || id === "session_duration")) {
      setSelectedStat(id);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col border-r border-neutral-100 dark:border-neutral-800 last:border-r-0 text-nowrap min-w-0",
        isSelectable ? "cursor-pointer" : "cursor-default",
        isSelectable && selectedStat === id && "bg-neutral-0 dark:bg-neutral-850"
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex flex-col px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        <div className={cn("text-2xl font-medium flex gap-2 items-center justify-between", accent)}>
          {isLoading ? (
            <Skeleton className="w-[60px] h-9 rounded-md" />
          ) : valueFormatter ? (
            valueFormatter(value)
          ) : (
            <span className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger>
                  <NumberFlow
                    respectMotionPreference={false}
                    value={decimals ? Number(value.toFixed(decimals)) : value}
                    format={{ notation: "compact" }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <NumberFlow
                    respectMotionPreference={false}
                    value={decimals ? Number(value.toFixed(decimals)) : value}
                    format={{ notation: "standard" }}
                  />
                  {postfix && <span>{postfix}</span>}
                </TooltipContent>
              </Tooltip>
              {postfix && <span>{postfix}</span>}
              {trailing}
            </span>
          )}
        </div>
      </div>
      {selectable && id !== "online" && id !== "revenue" && id !== "conversion_rate" && id !== "revenue_per_visitor" && (
        <div className="h-[40px] -mt-4">
          <SparklinesChart data={sparklinesData} isHovering={isHovering} />
        </div>
      )}
    </div>
  );
};

export function OverviewLite() {
  const { site } = useStore();
  const t = useExtracted();

  const { data: overviewData, isLoading } = useGetOverview({ site, lite: true });
  const { data: liveUsers, isLoading: liveLoading } = useGetLiveUserCount(5);
  const { data: stripeStatus } = useStripeRevenueStatus();
  const { data: revenueOverview, isLoading: revenueLoading } = useRevenueOverview();
  const showRevenue = REVENUE_ATTRIBUTION;
  const stripeConnected = Boolean(stripeStatus?.connected);

  const visitors = overviewData?.data?.users ?? 0;
  const bounceRate = overviewData?.data?.bounce_rate ?? 0;
  const sessionDuration = overviewData?.data?.session_duration ?? 0;

  const revenueCents = revenueOverview?.totals.revenue_cents ?? 0;
  const paymentCount = revenueOverview?.totals.payment_count ?? 0;
  const conversionRate = visitors > 0 ? (paymentCount / visitors) * 100 : 0;
  const revenuePerVisitorCents = visitors > 0 ? revenueCents / visitors : 0;
  const onlineCount = liveUsers?.count ?? 0;

  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-4 gap-0 items-stretch w-full",
        showRevenue ? "lg:grid-cols-7" : "lg:grid-cols-4"
      )}
    >
        <Stat title={t("Visitors")} id="users" value={visitors} isLoading={isLoading} />
        {showRevenue && (
          <>
            <Stat
              title={t("Revenue")}
              id="revenue"
              value={revenueCents}
              isLoading={revenueLoading}
              selectable={false}
              valueFormatter={formatRevenue}
              accent="text-green-600 dark:text-green-400"
              trailing={
                !stripeConnected && !revenueLoading ? (
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5">
                    {t("Connect Stripe in Settings")}
                  </span>
                ) : undefined
              }
            />
            <Stat
              title={t("Conversion rate")}
              id="conversion_rate"
              value={conversionRate}
              isLoading={revenueLoading || isLoading}
              selectable={false}
              postfix="%"
              decimals={2}
            />
            <Stat
              title={t("Revenue/visitor")}
              id="revenue_per_visitor"
              value={revenuePerVisitorCents}
              isLoading={revenueLoading || isLoading}
              selectable={false}
              valueFormatter={cents => formatRevenuePrecise(cents)}
            />
          </>
        )}
        <Stat
          title={t("Bounce rate")}
          id="bounce_rate"
          value={bounceRate}
          isLoading={isLoading}
          postfix="%"
          decimals={1}
        />
        <Stat
          title={t("Session time")}
          id="session_duration"
          value={sessionDuration}
          isLoading={isLoading}
          valueFormatter={formatSecondsAsMinutesAndSeconds}
        />
        <Stat
          title={t("Online")}
          id="online"
          value={onlineCount}
          isLoading={liveLoading}
          selectable={false}
          trailing={
            onlineCount > 0 ? (
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-neutral-400 shrink-0" />
            )
          }
        />
    </div>
  );
}