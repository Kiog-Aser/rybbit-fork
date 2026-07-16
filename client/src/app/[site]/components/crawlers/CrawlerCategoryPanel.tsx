"use client";

import { DateTime } from "luxon";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { useGetBotDimension } from "../../../../api/analytics/hooks/bots/useGetBotDimension";
import { useGetBotTimeSeriesByCrawler } from "../../../../api/analytics/hooks/bots/useGetBotTimeSeriesByCrawler";
import { ChartTooltip } from "../../../../components/charts/ChartTooltip";
import { TimeSeriesChart, type TimeSeriesChartSeries } from "../../../../components/charts/TimeSeriesChart";
import { getChartTimeBounds } from "../../../../components/charts/timeSeriesChartUtils";
import { CrawlerLogo } from "../../../../components/CrawlerLogo";
import { CardLoader } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  aggregateCrawlerRows,
  getCrawlerBrandStyle,
  getCrawlerDisplayName,
  type CrawlerPurposeCategory,
} from "../../../../lib/botCrawlerNames";
import { formatChartDateTime } from "../../../../lib/dateTimeUtils";
import { getTimezone, useStore } from "../../../../lib/store";
import { type BotCategoryFilter } from "../../bots/botsStore";

export const CRAWLER_CATEGORY_COLORS: Record<Exclude<BotCategoryFilter, "all">, string> = {
  ai_answers: "hsl(var(--accent-400))",
  indexing: "#34a853",
  training: "#cc785c",
};

/** Fallback palette when a brand has no fixed color */
const FALLBACK_SERIES_COLORS = [
  "#10a37f",
  "#0089d6",
  "#cc785c",
  "#20808d",
  "#34a853",
  "#a78bfa",
  "#ff7000",
  "#de5833",
  "#818cf8",
  "#e5e5e5",
];

const MAX_SERIES = 8;

type CrawlerCategoryPanelProps = {
  category: Exclude<BotCategoryFilter, "all">;
  chartHeight?: number;
  crawlerLimit?: number;
};

/**
 * Build one chart series per crawler brand.
 * Aligns every series onto a shared time grid (zeros for gaps) so hover tooltips
 * always show every provider at the same bucket — DataFast-style.
 */
function buildProviderSeries(
  raw: { time: string; bot_requests: number; crawler?: string }[] | undefined,
  category: CrawlerPurposeCategory,
  time: ReturnType<typeof useStore.getState>["time"],
  bucket: ReturnType<typeof useStore.getState>["bucket"],
  timezone: string,
  topLabels: string[]
): TimeSeriesChartSeries[] {
  const { min: boundsMin, max: boundsMax } = getChartTimeBounds(time, bucket, timezone);
  const now = DateTime.now();

  // label → timeMs → count
  const byLabel = new Map<string, Map<number, number>>();
  const allTimes = new Set<number>();

  for (const item of raw ?? []) {
    if (!item.crawler) continue;
    const label = getCrawlerDisplayName(item.crawler, category);
    if (topLabels.length > 0 && !topLabels.includes(label)) continue;

    const timestamp = DateTime.fromSQL(item.time, { zone: timezone }).toUTC();
    if (timestamp > now) continue;
    const ms = timestamp.toMillis();
    if (boundsMin && ms < boundsMin.getTime()) continue;
    if (boundsMax && ms > boundsMax.getTime()) continue;

    allTimes.add(ms);
    let seriesMap = byLabel.get(label);
    if (!seriesMap) {
      seriesMap = new Map();
      byLabel.set(label, seriesMap);
    }
    seriesMap.set(ms, (seriesMap.get(ms) ?? 0) + item.bot_requests);
  }

  const sortedTimes = [...allTimes].sort((a, b) => a - b);
  // Prefer topLabels order (by total volume); fall back to whatever appeared
  const labels =
    topLabels.length > 0
      ? topLabels.filter(l => byLabel.has(l))
      : [...byLabel.entries()]
          .map(([label, m]) => ({
            label,
            total: [...m.values()].reduce((s, v) => s + v, 0),
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, MAX_SERIES)
          .map(e => e.label);

  return labels.map((label, idx) => {
    const brand = getCrawlerBrandStyle(label);
    const color =
      brand.foreground && brand.foreground !== "inherit"
        ? brand.foreground
        : FALLBACK_SERIES_COLORS[idx % FALLBACK_SERIES_COLORS.length];
    const seriesMap = byLabel.get(label) ?? new Map();
    return {
      id: label,
      color,
      strokeWidth: 2,
      data: sortedTimes.map(ms => ({
        x: new Date(ms),
        y: seriesMap.get(ms) ?? 0,
      })),
    };
  });
}

export function CrawlerCategoryPanel({
  category,
  chartHeight = 314,
  crawlerLimit = 12,
}: CrawlerCategoryPanelProps) {
  const t = useExtracted();
  const { site: siteId, bucket, time } = useStore();
  const timezone = getTimezone();

  const { data: seriesData, isLoading: chartLoading, isFetching } = useGetBotTimeSeriesByCrawler({
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

  const crawlerItems = crawlers?.data?.data?.filter(i => i.value) ?? [];
  const aggregated = useMemo(
    () => aggregateCrawlerRows(crawlerItems, category as CrawlerPurposeCategory),
    [crawlerItems, category]
  );
  const topLabels = useMemo(() => aggregated.slice(0, MAX_SERIES).map(a => a.label), [aggregated]);

  const { chartMin, chartMax, max, series } = useMemo(() => {
    const built = buildProviderSeries(
      seriesData?.data,
      category as CrawlerPurposeCategory,
      time,
      bucket,
      timezone,
      topLabels
    );
    const allPoints = built.flatMap(s => s.data);
    const dataMin = allPoints.length ? allPoints[0].x : undefined;
    const dataMax = allPoints.length ? allPoints[allPoints.length - 1].x : undefined;
    const { min: boundsMin, max: boundsMax } = getChartTimeBounds(time, bucket, timezone);

    return {
      series: built,
      chartMin: dataMin ?? boundsMin,
      chartMax: dataMax ?? boundsMax ?? DateTime.now().toJSDate(),
      max: allPoints.reduce((largest, p) => Math.max(largest, p.y), 0),
    };
  }, [seriesData?.data, category, time, bucket, timezone, topLabels]);

  return (
    <div className="relative">
      {isFetching && <CardLoader />}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3" style={{ height: chartHeight }}>
        <div className="h-full min-h-[180px]">
          {chartLoading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : series.every(s => s.data.length === 0) ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {t("No bot data available")}
            </div>
          ) : (
            <TimeSeriesChart
              current={[]}
              series={series}
              max={max || 1}
              chartMin={chartMin}
              chartMax={chartMax}
              currentColor={CRAWLER_CATEGORY_COLORS[category]}
              disableDragZoom
              yTickFormat={v => Number(v).toLocaleString()}
              renderTooltip={({ point, points, bucket: chartBucket }) => {
                const total = points.reduce((s, p) => s + p.point.y, 0);
                // Sort by volume so the biggest providers appear first
                const sorted = [...points].sort((a, b) => b.point.y - a.point.y);
                return (
                  <ChartTooltip>
                    <div className="p-3 min-w-[180px]">
                      <div className="mb-2 text-xs text-muted-foreground">
                        {formatChartDateTime(DateTime.fromJSDate(point.x), chartBucket)}
                      </div>
                      <div className="space-y-1.5">
                        {sorted.map(entry => (
                          <div key={entry.id} className="flex justify-between items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-1.5 h-3 rounded-[2px] shrink-0"
                                style={{ backgroundColor: entry.color }}
                              />
                              <CrawlerLogo label={entry.id} size={14} />
                              <span className="truncate">{entry.id}</span>
                            </div>
                            <span className="font-medium tabular-nums shrink-0">
                              {entry.point.y.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                      {sorted.length > 1 && (
                        <div className="mt-2 pt-2 border-t border-neutral-700/50 flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("Total")}</span>
                          <span className="font-semibold tabular-nums">{total.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </ChartTooltip>
                );
              }}
            />
          )}
        </div>

        <CrawlerList
          items={crawlerItems}
          loading={crawlersLoading}
          maxHeight={chartHeight}
          category={category as CrawlerPurposeCategory}
        />
      </div>
    </div>
  );
}

export function CrawlerList({
  items,
  loading,
  maxHeight,
  category = "all",
}: {
  items: { value: string; count: number }[];
  loading: boolean;
  maxHeight: number;
  category?: CrawlerPurposeCategory;
}) {
  const t = useExtracted();
  const aggregated = aggregateCrawlerRows(items, category);

  return (
    <div className="space-y-0.5 overflow-y-auto pr-1" style={{ maxHeight }}>
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)
      ) : aggregated.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">{t("No crawlers yet")}</p>
      ) : (
        aggregated.map(item => {
          const brand = getCrawlerBrandStyle(item.label);
          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
              style={{ backgroundColor: brand.background }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CrawlerLogo label={item.label} size={16} />
                <span className="text-xs font-medium truncate" style={{ color: brand.foreground }}>
                  {item.label}
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
