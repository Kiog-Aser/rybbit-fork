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
import { TimeSeriesChart } from "../../../../../components/charts/TimeSeriesChart";
import { getChartTimeBounds } from "../../../../../components/charts/timeSeriesChartUtils";
import { CrawlerLogo } from "../../../../../components/CrawlerLogo";
import { CardLoader } from "../../../../../components/ui/card";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { getCrawlerBrandStyle, getCrawlerDisplayName } from "../../../../../lib/botCrawlerNames";
import { formatChartDateTime } from "../../../../../lib/dateTimeUtils";
import { getTimezone, useStore } from "../../../../../lib/store";
import { type BotCategoryFilter } from "../../../bots/botsStore";
import {
  StandardSectionTabs,
  type StandardSectionTab,
} from "../../../components/shared/StandardSection/StandardSectionTabs";

type Tab = "ai_answers" | "indexing" | "training";

const CATEGORY_COLORS: Record<Tab, string> = {
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

function CrawlerCategoryPanel({ category }: { category: Tab }) {
  const t = useExtracted();
  const { site: siteId, bucket, time } = useStore();
  const timezone = getTimezone();
  const color = CATEGORY_COLORS[category];

  const { data: seriesData, isLoading: chartLoading, isFetching } = useGetBotTimeSeriesByCategory({
    site: siteId,
    category,
  });
  const { data: crawlers, isLoading: crawlersLoading } = useGetBotDimension({
    site: siteId,
    dimension: "matched_ua_pattern",
    limit: 12,
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-3 h-[314px]">
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

        <div className="space-y-1 overflow-y-auto max-h-[314px] pr-1">
          {crawlersLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)
          ) : crawlerItems.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">{t("No crawlers yet")}</p>
          ) : (
            crawlerItems.map(item => {
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
                  <span className="text-xs font-semibold tabular-nums" style={{ color: brand.foreground }}>
                    {item.count}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function CrawlersLite() {
  const t = useExtracted();
  const { site } = useParams();
  const { site: siteId } = useStore();
  const { data: overview, isLoading: overviewLoading } = useGetBotOverview({ site: siteId });

  const countFor = (key: BotCategoryFilter) => {
    if (!overview?.data) return 0;
    if (key === "ai_answers") return overview.data.category_ai_answers ?? 0;
    if (key === "indexing") return overview.data.category_indexing ?? 0;
    return overview.data.category_training ?? 0;
  };

  const tabLabel = (key: Tab, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {overviewLoading ? (
        <Skeleton className="h-3.5 w-6 rounded" />
      ) : (
        <span className="text-muted-foreground tabular-nums">
          <NumberFlow respectMotionPreference={false} value={countFor(key)} format={{ notation: "compact" }} />
        </span>
      )}
    </span>
  );

  const tabs: StandardSectionTab<Tab>[] = [
    {
      value: "ai_answers",
      label: tabLabel("ai_answers", t("AI answers")),
      content: <CrawlerCategoryPanel category="ai_answers" />,
      dialogContent: <CrawlerCategoryPanel category="ai_answers" />,
      dialogTitle: t("AI answers"),
    },
    {
      value: "indexing",
      label: tabLabel("indexing", t("Indexing")),
      content: <CrawlerCategoryPanel category="indexing" />,
      dialogContent: <CrawlerCategoryPanel category="indexing" />,
      dialogTitle: t("Indexing"),
    },
    {
      value: "training",
      label: tabLabel("training", t("Training")),
      content: <CrawlerCategoryPanel category="training" />,
      dialogContent: <CrawlerCategoryPanel category="training" />,
      dialogTitle: t("Training"),
    },
  ];

  return (
    <StandardSectionTabs
      defaultValue="ai_answers"
      tabs={tabs}
      renderTabsListEnd={() => (
        <Link
          href={`/${site}/bots`}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors pr-1"
        >
          {t("Details")}
        </Link>
      )}
    />
  );
}