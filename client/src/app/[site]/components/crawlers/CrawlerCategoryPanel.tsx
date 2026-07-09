"use client";

import { DateTime } from "luxon";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { useGetBotDimension } from "../../../../api/analytics/hooks/bots/useGetBotDimension";
import { useGetBotTimeSeriesByCategory } from "../../../../api/analytics/hooks/bots/useGetBotTimeSeriesByCategory";
import { ChartTooltip } from "../../../../components/charts/ChartTooltip";
import { TimeSeriesChart } from "../../../../components/charts/TimeSeriesChart";
import { getChartTimeBounds } from "../../../../components/charts/timeSeriesChartUtils";
import { CrawlerLogo } from "../../../../components/CrawlerLogo";
import { CardLoader } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { getCrawlerBrandStyle, getCrawlerDisplayName } from "../../../../lib/botCrawlerNames";
import { formatChartDateTime } from "../../../../lib/dateTimeUtils";
import { getTimezone, useStore } from "../../../../lib/store";
import { type BotCategoryFilter } from "../../bots/botsStore";

export const CRAWLER_CATEGORY_COLORS: Record<Exclude<BotCategoryFilter, "all">, string> = {
  ai_answers: "hsl(var(--accent-400))",
  indexing: "#34a853",
  training: "#cc785c",
};

function buildPoints(
  raw: { time: string; bot_requests: number }[] | undefined,
  time: ReturnType<typeof useStore.getState>["time"],
  bucket: ReturnType<typeof useStore.getState>["bucket"],
  timezone: string
) {
  const { min: boundsMin, max: boundsMax } = getChartTimeBounds(time, bucket, timezone);
  const now = DateTime.now();
  const points: { x: Date; y: number }[] = [];

  raw?.forEach(item => {
    const timestamp = DateTime.fromSQL(item.time, { zone: timezone }).toUTC();
    if (timestamp > now) return;
    const ms = timestamp.toMillis();
    if (boundsMin && ms < boundsMin.getTime()) return;
    if (boundsMax && ms > boundsMax.getTime()) return;
    points.push({ x: timestamp.toJSDate(), y: item.bot_requests });
  });

  return points;
}

type CrawlerCategoryPanelProps = {
  category: Exclude<BotCategoryFilter, "all">;
  chartHeight?: number;
  crawlerLimit?: number;
};

export function CrawlerCategoryPanel({
  category,
  chartHeight = 314,
  crawlerLimit = 12,
}: CrawlerCategoryPanelProps) {
  const t = useExtracted();
  const { site: siteId, bucket, time } = useStore();
  const timezone = getTimezone();
  const color = CRAWLER_CATEGORY_COLORS[category];

  const { data: seriesData, isLoading: chartLoading, isFetching } = useGetBotTimeSeriesByCategory({
    site: siteId,
    category,
  });
  const { data: crawlers, isLoading: crawlersLoading } = useGetBotDimension({
    site: siteId,
    dimension: "matched_ua_pattern",
    limit: crawlerLimit,
    page: 1,
    category,
  });

  const { chartMin, chartMax, max, points } = useMemo(() => {
    const built = buildPoints(seriesData?.data, time, bucket, timezone);
    const dataMin = built.length ? built[0].x : undefined;
    const dataMax = built.length ? built[built.length - 1].x : undefined;
    const { min: boundsMin, max: boundsMax } = getChartTimeBounds(time, bucket, timezone);

    return {
      points: built,
      chartMin: dataMin ?? boundsMin,
      chartMax: dataMax ?? boundsMax ?? DateTime.now().toJSDate(),
      max: built.reduce((largest, p) => Math.max(largest, p.y), 0),
    };
  }, [seriesData?.data, time, bucket, timezone]);

  const crawlerItems = crawlers?.data?.data?.filter(i => i.value) ?? [];

  return (
    <div className="relative">
      {isFetching && <CardLoader />}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3"
        style={{ height: chartHeight }}
      >
        <div className="h-full min-h-[180px]">
          {chartLoading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : (
            <TimeSeriesChart
              current={points}
              max={max || 1}
              chartMin={chartMin}
              chartMax={chartMax}
              currentColor={color}
              disableDragZoom
              yTickFormat={v => Number(v).toLocaleString()}
              renderTooltip={({ point }) => (
                <ChartTooltip>
                  <div className="p-3 min-w-[140px]">
                    <div className="mb-2 text-xs">{formatChartDateTime(DateTime.fromJSDate(point.x), bucket)}</div>
                    <div className="font-medium tabular-nums">{point.y.toLocaleString()} requests</div>
                  </div>
                </ChartTooltip>
              )}
            />
          )}
        </div>

        <CrawlerList items={crawlerItems} loading={crawlersLoading} maxHeight={chartHeight} />
      </div>
    </div>
  );
}

export function CrawlerList({
  items,
  loading,
  maxHeight,
}: {
  items: { value: string; count: number }[];
  loading: boolean;
  maxHeight: number;
}) {
  const t = useExtracted();

  return (
    <div className="space-y-0.5 overflow-y-auto pr-1" style={{ maxHeight }}>
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">{t("No crawlers yet")}</p>
      ) : (
        items.map(item => {
          const label = getCrawlerDisplayName(item.value);
          const brand = getCrawlerBrandStyle(label);
          return (
            <div
              key={item.value}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
              style={{ backgroundColor: brand.background }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CrawlerLogo label={label} size={16} />
                <span className="text-xs font-medium truncate" style={{ color: brand.foreground }}>
                  {label}
                </span>
              </div>
              <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: brand.foreground }}>
                {item.count.toLocaleString()}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}