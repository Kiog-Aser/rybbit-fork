"use client";

import { DateTime } from "luxon";
import { useMemo } from "react";
import { useGetBotTimeSeriesByCategory } from "../../../../api/analytics/hooks/bots/useGetBotTimeSeriesByCategory";
import { BucketSelection } from "../../../../components/BucketSelection";
import { ChartTooltip } from "../../../../components/charts/ChartTooltip";
import { TimeSeriesChart, type TimeSeriesChartSeries } from "../../../../components/charts/TimeSeriesChart";
import { getChartTimeBounds } from "../../../../components/charts/timeSeriesChartUtils";
import { Card, CardContent, CardLoader } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { formatChartDateTime } from "../../../../lib/dateTimeUtils";
import { getTimezone, useStore } from "../../../../lib/store";
import { useBotsStore, type BotCategoryFilter } from "../botsStore";

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

export function BotMultiSeriesChart() {
  const { site, bucket, time } = useStore();
  const timezone = getTimezone();
  const { selectedCategory } = useBotsStore();

  const aiAnswers = useGetBotTimeSeriesByCategory({ site, category: "ai_answers" });
  const indexing = useGetBotTimeSeriesByCategory({ site, category: "indexing" });
  const training = useGetBotTimeSeriesByCategory({ site, category: "training" });

  const isFetching = aiAnswers.isFetching || indexing.isFetching || training.isFetching;
  const isLoading = aiAnswers.isLoading || indexing.isLoading || training.isLoading;

  const { chartMin, chartMax, max, activeSeries, multi } = useMemo(() => {
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
      selectedCategory === "all"
        ? built
        : built.filter(s => s.id === CATEGORY_META.find(c => c.key === selectedCategory)?.label);

    const allPoints = visible.flatMap(s => s.data);
    const dataMin = allPoints.length ? allPoints[0].x : undefined;
    const dataMax = allPoints.length ? allPoints[allPoints.length - 1].x : undefined;
    const { min: boundsMin, max: boundsMax } = getChartTimeBounds(time, bucket, timezone);

    return {
      activeSeries: visible,
      multi: selectedCategory === "all" && visible.length > 1,
      chartMin: dataMin ?? boundsMin,
      chartMax: dataMax ?? boundsMax ?? DateTime.now().toJSDate(),
      max: allPoints.reduce((largest, p) => Math.max(largest, p.y), 0),
    };
  }, [aiAnswers.data, indexing.data, training.data, time, bucket, timezone, selectedCategory]);

  return (
    <Card className="overflow-visible">
      {isFetching && (
        <div className="absolute inset-x-0 top-0 h-4 overflow-hidden rounded-t-lg pointer-events-none">
          <CardLoader />
        </div>
      )}
      <CardContent className="p-2 md:p-4 py-3 w-full">
        <div className="flex items-center justify-between px-2 md:px-0 mb-2">
          <span className="text-sm font-medium text-foreground">Crawler activity</span>
          <BucketSelection />
        </div>
        {isLoading ? (
          <Skeleton className="w-full h-[300px] rounded-md" />
        ) : activeSeries.every(s => s.data.length === 0) ? (
          <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No bot data available</p>
              <p className="text-sm">Try adjusting your date range or filters</p>
            </div>
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <TimeSeriesChart
              current={multi ? [] : activeSeries[0]?.data ?? []}
              series={multi ? activeSeries : undefined}
              max={max || 1}
              chartMin={chartMin}
              chartMax={chartMax}
              currentColor={activeSeries[0]?.color ?? CATEGORY_META[0].color}
              yTickFormat={value => Number(value).toLocaleString()}
              renderTooltip={({ point, points, bucket: chartBucket }) => (
                <ChartTooltip>
                  <div className="p-3 min-w-[150px]">
                    <div className="mb-2">{formatChartDateTime(DateTime.fromJSDate(point.x), chartBucket)}</div>
                    {multi ? (
                      points.map(entry => (
                        <div key={entry.id} className="flex justify-between items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3 rounded-[3px]" style={{ backgroundColor: entry.color }} />
                            <span>{entry.id}</span>
                          </div>
                          <span className="font-medium tabular-nums">{entry.point.y.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1 h-3 rounded-[3px]"
                            style={{ backgroundColor: activeSeries[0]?.color }}
                          />
                          <span>Requests</span>
                        </div>
                        <span className="font-medium">{point.y.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </ChartTooltip>
              )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}