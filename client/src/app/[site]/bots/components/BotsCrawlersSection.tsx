"use client";

import NumberFlow from "@number-flow/react";
import { DateTime } from "luxon";
import { useExtracted } from "next-intl";
import React, { useMemo } from "react";
import { useGetBotDimension } from "../../../../api/analytics/hooks/bots/useGetBotDimension";
import { useGetBotOverview } from "../../../../api/analytics/hooks/bots/useGetBotOverview";
import { useGetBotTimeSeriesByCategory } from "../../../../api/analytics/hooks/bots/useGetBotTimeSeriesByCategory";
import { BucketSelection } from "../../../../components/BucketSelection";
import { ChartTooltip } from "../../../../components/charts/ChartTooltip";
import { TimeSeriesChart, type TimeSeriesChartSeries } from "../../../../components/charts/TimeSeriesChart";
import { getChartTimeBounds } from "../../../../components/charts/timeSeriesChartUtils";
import { Card, CardContent, CardLoader } from "../../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/basic-tabs";
import { Skeleton } from "../../../../components/ui/skeleton";
import { formatChartDateTime } from "../../../../lib/dateTimeUtils";
import { getTimezone, useStore } from "../../../../lib/store";
import {
  CrawlerCategoryPanel,
  CrawlerList,
  CRAWLER_CATEGORY_COLORS,
} from "../../components/crawlers/CrawlerCategoryPanel";
import { type BotCategoryFilter, useBotsStore } from "../botsStore";

const CHART_HEIGHT = 360;

const CATEGORY_TABS: BotCategoryFilter[] = ["all", "ai_answers", "indexing", "training"];

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

function AllCrawlersPanel() {
  const t = useExtracted();
  const { site, bucket, time } = useStore();
  const timezone = getTimezone();

  const aiAnswers = useGetBotTimeSeriesByCategory({ site, category: "ai_answers" });
  const indexing = useGetBotTimeSeriesByCategory({ site, category: "indexing" });
  const training = useGetBotTimeSeriesByCategory({ site, category: "training" });
  const { data: crawlers, isLoading: crawlersLoading, isFetching: crawlersFetching } = useGetBotDimension({
    site,
    dimension: "matched_ua_pattern",
    limit: 50,
    page: 1,
    category: "all",
  });

  const isFetching = aiAnswers.isFetching || indexing.isFetching || training.isFetching || crawlersFetching;
  const isLoading = aiAnswers.isLoading || indexing.isLoading || training.isLoading;

  const { chartMin, chartMax, max, series } = useMemo(() => {
    const datasets: TimeSeriesChartSeries[] = [
      { id: t("AI answers"), color: CRAWLER_CATEGORY_COLORS.ai_answers, data: buildPoints(aiAnswers.data?.data, time, bucket, timezone) },
      { id: t("Indexing"), color: CRAWLER_CATEGORY_COLORS.indexing, data: buildPoints(indexing.data?.data, time, bucket, timezone) },
      { id: t("Training"), color: CRAWLER_CATEGORY_COLORS.training, data: buildPoints(training.data?.data, time, bucket, timezone) },
    ];

    const allPoints = datasets.flatMap(s => s.data);
    const dataMin = allPoints.length ? allPoints[0].x : undefined;
    const dataMax = allPoints.length ? allPoints[allPoints.length - 1].x : undefined;
    const { min: boundsMin, max: boundsMax } = getChartTimeBounds(time, bucket, timezone);

    return {
      series: datasets,
      chartMin: dataMin ?? boundsMin,
      chartMax: dataMax ?? boundsMax ?? DateTime.now().toJSDate(),
      max: allPoints.reduce((largest, p) => Math.max(largest, p.y), 0),
    };
  }, [aiAnswers.data, indexing.data, training.data, time, bucket, timezone, t]);

  const crawlerItems = crawlers?.data?.data?.filter(i => i.value) ?? [];

  return (
    <div className="relative">
      {isFetching && <CardLoader />}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3" style={{ height: CHART_HEIGHT }}>
        <div className="h-full min-h-[180px]">
          {isLoading ? (
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
              currentColor={CRAWLER_CATEGORY_COLORS.ai_answers}
              yTickFormat={value => Number(value).toLocaleString()}
              renderTooltip={({ point, points, bucket: chartBucket }) => (
                <ChartTooltip>
                  <div className="p-3 min-w-[150px]">
                    <div className="mb-2 text-xs">{formatChartDateTime(DateTime.fromJSDate(point.x), chartBucket)}</div>
                    {points.map(entry => (
                      <div key={entry.id} className="flex justify-between items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3 rounded-[3px]" style={{ backgroundColor: entry.color }} />
                          <span>{entry.id}</span>
                        </div>
                        <span className="font-medium tabular-nums">{entry.point.y.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </ChartTooltip>
              )}
            />
          )}
        </div>
        <CrawlerList items={crawlerItems} loading={crawlersLoading} maxHeight={CHART_HEIGHT} />
      </div>
    </div>
  );
}

export function BotsCrawlersSection() {
  const t = useExtracted();
  const { site } = useStore();
  const { selectedCategory, setSelectedCategory } = useBotsStore();
  const { data: overview, isLoading: overviewLoading } = useGetBotOverview({ site });

  const countFor = (key: BotCategoryFilter) => {
    if (!overview?.data) return 0;
    if (key === "all") return overview.data.category_all ?? 0;
    if (key === "ai_answers") return overview.data.category_ai_answers ?? 0;
    if (key === "indexing") return overview.data.category_indexing ?? 0;
    return overview.data.category_training ?? 0;
  };

  const tabLabels: Record<BotCategoryFilter, React.ReactNode> = {
    all: t("All"),
    ai_answers: t("AI answers"),
    indexing: t("Indexing"),
    training: t("Training"),
  };

  const tabLabel = (key: BotCategoryFilter) => (
    <span className="inline-flex items-center gap-1.5">
      {tabLabels[key]}
      {overviewLoading ? (
        <Skeleton className="h-3.5 w-6 rounded" />
      ) : (
        <span className="text-muted-foreground tabular-nums">
          <NumberFlow respectMotionPreference={false} value={countFor(key)} format={{ notation: "compact" }} />
        </span>
      )}
    </span>
  );

  return (
    <Card>
      <CardContent className="p-2 md:p-4 pt-3">
        <Tabs
          value={selectedCategory}
          onValueChange={value => setSelectedCategory(value as BotCategoryFilter)}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="overflow-x-auto min-w-0">
              <TabsList>
                {CATEGORY_TABS.map(key => (
                  <TabsTrigger key={key} value={key}>
                    {tabLabel(key)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <BucketSelection />
          </div>

          <TabsContent value="all">
            <AllCrawlersPanel />
          </TabsContent>
          <TabsContent value="ai_answers">
            <CrawlerCategoryPanel category="ai_answers" chartHeight={CHART_HEIGHT} crawlerLimit={50} />
          </TabsContent>
          <TabsContent value="indexing">
            <CrawlerCategoryPanel category="indexing" chartHeight={CHART_HEIGHT} crawlerLimit={50} />
          </TabsContent>
          <TabsContent value="training">
            <CrawlerCategoryPanel category="training" chartHeight={CHART_HEIGHT} crawlerLimit={50} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}