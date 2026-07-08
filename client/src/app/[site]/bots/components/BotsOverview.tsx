"use client";

import NumberFlow from "@number-flow/react";
import { useGetBotOverview } from "../../../../api/analytics/hooks/bots/useGetBotOverview";
import { Card, CardContent, CardLoader } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { useStore } from "../../../../lib/store";
import { cn } from "../../../../lib/utils";
import { type BotCategoryFilter, useBotsStore } from "../botsStore";

type BotCategoryCounts = {
  category_all: number;
  category_ai_answers: number;
  category_indexing: number;
  category_training: number;
};

const CATEGORY_PILLS: { key: BotCategoryFilter; label: string; countKey: keyof BotCategoryCounts }[] = [
  { key: "all", label: "All", countKey: "category_all" },
  { key: "ai_answers", label: "AI answers", countKey: "category_ai_answers" },
  { key: "indexing", label: "Indexing", countKey: "category_indexing" },
  { key: "training", label: "Training", countKey: "category_training" },
];

export function BotsOverview() {
  const { site } = useStore();
  const { selectedCategory, setSelectedCategory } = useBotsStore();
  const { data, isLoading, isFetching } = useGetBotOverview({ site });
  const overview = data?.data;

  return (
    <Card>
      {isFetching && <CardLoader />}
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_PILLS.map(pill => {
            const count = overview?.[pill.countKey] ?? 0;
            const active = selectedCategory === pill.key;

            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setSelectedCategory(pill.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors border",
                  active
                    ? "bg-foreground text-background border-transparent"
                    : "bg-transparent text-muted-foreground border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                )}
              >
                <span>{pill.label}</span>
                {isLoading ? (
                  <Skeleton className="h-5 w-8 rounded-full" />
                ) : (
                  <span className={cn("tabular-nums", active ? "opacity-90" : "text-muted-foreground")}>
                    <NumberFlow respectMotionPreference={false} value={count} format={{ notation: "compact" }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}