"use client";

import NumberFlow from "@number-flow/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { DateTime } from "luxon";
import { useGetBotDimension } from "../../../../../api/analytics/hooks/bots/useGetBotDimension";
import { useGetBotOverview } from "../../../../../api/analytics/hooks/bots/useGetBotOverview";
import { useGetBotTimeSeriesByCategory } from "../../../../../api/analytics/hooks/bots/useGetBotTimeSeriesByCategory";
import { ChartTooltip } from "../../../../../components/charts/ChartTooltip";
import { TimeSeriesChart, type TimeSeriesChartSeries } from "../../../../../components/charts/TimeSeriesChart";
import { getChartTimeBounds } from "../../../../../components/charts/timeSeriesChartUtils";
import { Card, CardContent, CardLoader } from "../../../../../components/ui/card";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { getCrawlerBrandStyle, getCrawlerDisplayName } from "../../../../../lib/botCrawlerNames";
import { formatChartDateTime } from "../../../../../lib/dateTimeUtils";
import { getTimezone, useStore } from "../../../../../lib/store";
import { cn } from "../../../../../lib/utils";
import { useBotsStore, type BotCategoryFilter } from "../../../bots/botsStore";

const CATEGORY_META: { key: BotCategoryFilter; label: string; color: string }[] = [
  { key: "ai_answers", label: "AI answers", color: "hsl(var(--accent-400))" },
  { key: "indexing", label: "Indexing", color: "#34a853" },
  { key: "training", label: "Training", color: "#cc785c" },
];

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

export function CrawlersLite() {
  const t = useExtracted();
  const { site } = useParams();
  const { site: siteId, bucket, time } = useStore();
  const timezone = getTimezone();
  const { selectedCategory, setSelectedCategory } = useBotsStore();

  const { data: overview, isLoading: overviewLoading } = useGetBotOverview({ site: siteId });
  const { data: crawlers, isLoading: crawlersLoading } = useGetBotDimension({
    site: siteId,
    dimension: "matched_ua_pattern",
    limit: 8,
    page: 1,
  });

  const aiAnswers = useGetBotTimeSeriesByCategory({ site: siteId, category: "ai_answers" });
  const indexing = useGetBotTimeSeriesByCategory({ site: siteId, category: "indexing" });
  const training = useGetBotTimeSeriesByCategory({ site: siteId, category: "training" });

  const { chartMin, chartMax, max, activeSeries } = useMemo(() => {
    const datasets = [
      { meta: CATEGORY_META[0], data: aiAnswers.data?.data },
      { meta: CATEGORY_META[1], data: indexing.data?.data },
      { meta: CATEGORY_META[2], data: training.data?.data },
    ];

    const built: TimeSeriesChartSeries[] = datasets.map(({ meta, data }) => ({
      id: meta.label,
      color: meta.color,
      data: buildPoints(data, time, bucket, timezone),
    }));

    const visible =
      selectedCategory === "all" ? built : built.filter(s => s.id === CATEGORY_META.find(c => c.key === selectedCategory)?.label);

    const allPoints = visible.flatMap(s => s.data);
    const dataMin = allPoints.length ? allPoints[0].x : undefined;
    const dataMax = allPoints.length ? allPoints[allPoints.length - 1].x : undefined;
    const { min: boundsMin, max: boundsMax } = getChartTimeBounds(time, bucket, timezone);

    return {
      activeSeries: visible,
      chartMin: dataMin ?? boundsMin,
      chartMax: dataMax ?? boundsMax ?? DateTime.now().toJSDate(),
      max: allPoints.reduce((largest, p) => Math.max(largest, p.y), 0),
    };
  }, [aiAnswers.data, indexing.data, training.data, time, bucket, timezone, selectedCategory]);

  const isFetching = aiAnswers.isFetching || indexing.isFetching || training.isFetching;
  const isChartLoading = aiAnswers.isLoading || indexing.isLoading || training.isLoading;
  const multi = selectedCategory === "all" && activeSeries.length > 1;

  const pills: { key: BotCategoryFilter; label: string; count: number }[] = [
    { key: "ai_answers", label: t("AI answers"), count: overview?.data?.category_ai_answers ?? 0 },
    { key: "indexing", label: t("Indexing"), count: overview?.data?.category_indexing ?? 0 },
    { key: "training", label: t("Training"), count: overview?.data?.category_training ?? 0 },
  ];

  const crawlerItems = crawlers?.data?.data?.filter(i => i.value) ?? [];

  return (
    <Card>
      {isFetching && <CardLoader />}
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{t("AI crawlers")}</h3>
          <Link href={`/${site}/bots`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t("Details")}
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {pills.map(pill => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === pill.key ? "all" : pill.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                selectedCategory === pill.key
                  ? "bg-foreground text-background border-transparent"
                  : "bg-transparent text-muted-foreground border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
              )}
            >
              <span>{pill.label}</span>
              {overviewLoading ? (
                <Skeleton className="h-4 w-6 rounded-full" />
              ) : (
                <NumberFlow respectMotionPreference={false} value={pill.count} format={{ notation: "compact" }} />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
          <div className="h-[180px]">
            {isChartLoading ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <TimeSeriesChart
                current={multi ? [] : activeSeries[0]?.data ?? []}
                series={multi ? activeSeries : undefined}
                max={max || 1}
                chartMin={chartMin}
                chartMax={chartMax}
                currentColor={activeSeries[0]?.color ?? CATEGORY_META[0].color}
                disableDragZoom
                yTickFormat={v => Number(v).toLocaleString()}
                renderTooltip={({ point, points }) => (
                  <ChartTooltip>
                    <div className="p-3 min-w-[140px]">
                      <div className="mb-2 text-xs">{formatChartDateTime(DateTime.fromJSDate(point.x), bucket)}</div>
                      {multi ? (
                        points.map(entry => (
                          <div key={entry.id} className="flex justify-between gap-3 text-xs">
                            <span style={{ color: entry.color }}>{entry.id}</span>
                            <span className="font-medium tabular-nums">{entry.point.y.toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <div className="font-medium tabular-nums">{point.y.toLocaleString()} requests</div>
                      )}
                    </div>
                  </ChartTooltip>
                )}
              />
            )}
          </div>

          <div className="space-y-1">
            {crawlersLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)
            ) : crawlerItems.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t("No crawlers yet")}</p>
            ) : (
              crawlerItems.map(item => {
                const label = getCrawlerDisplayName(item.value);
                const brand = getCrawlerBrandStyle(label);
                return (
                  <div
                    key={item.value}
                    className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2"
                    style={{ backgroundColor: brand.background }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm leading-none w-4 text-center">{brand.emoji}</span>
                      <span className="text-xs font-medium truncate" style={{ color: brand.foreground }}>
                        {label}
                      </span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: brand.foreground }}>
                      {item.count}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}