"use client";

import NumberFlow from "@number-flow/react";
import { useGetBotDimension } from "../../../../api/analytics/hooks/bots/useGetBotDimension";
import { Card, CardContent, CardLoader } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { getCrawlerDisplayName } from "../../../../lib/botCrawlerNames";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../../../lib/store";
import { type BotCategoryFilter, useBotsStore } from "../botsStore";

const CATEGORY_PILLS: { key: BotCategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ai_answers", label: "AI answers" },
  { key: "indexing", label: "Indexing" },
  { key: "training", label: "Training" },
];

export function BotCrawlers() {
  const { site } = useStore();
  const { selectedCategory, setSelectedCategory } = useBotsStore();
  const { data, isLoading, isFetching } = useGetBotDimension({
    site,
    dimension: "matched_ua_pattern",
    limit: 25,
    page: 1,
  });

  const crawlers =
    data?.data?.data.filter(item => item.value && item.value !== "").slice(0, 12) ?? [];
  const maxCount = crawlers[0]?.count ?? 1;

  return (
    <Card>
      {isFetching && <CardLoader />}
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Crawlers</h3>
            <p className="text-xs text-muted-foreground">Known bots hitting your site, grouped by user-agent pattern</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_PILLS.map(pill => (
              <button
                key={pill.key}
                type="button"
                onClick={() => setSelectedCategory(pill.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selectedCategory === pill.key
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ) : crawlers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No crawler traffic in this period. Bots are logged when bot blocking is enabled on the site.
          </p>
        ) : (
          <div className="space-y-1.5">
            {crawlers.map(item => (
              <div key={item.value} className="relative flex items-center h-8 rounded-md overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-dataviz/25 rounded-md"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
                <div className="relative z-10 flex w-full items-center justify-between gap-3 px-2 text-xs">
                  <span className="font-medium truncate">{getCrawlerDisplayName(item.value)}</span>
                  <span className="shrink-0 text-muted-foreground">
                    <NumberFlow respectMotionPreference={false} value={item.count} format={{ notation: "compact" }} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}