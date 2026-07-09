"use client";

import NumberFlow from "@number-flow/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useGetBotOverview } from "../../../../../api/analytics/hooks/bots/useGetBotOverview";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { useStore } from "../../../../../lib/store";
import { type BotCategoryFilter } from "../../../bots/botsStore";
import { CrawlerCategoryPanel } from "../../../components/crawlers/CrawlerCategoryPanel";
import {
  StandardSectionTabs,
  type StandardSectionTab,
} from "../../../components/shared/StandardSection/StandardSectionTabs";

type Tab = "ai_answers" | "indexing" | "training";

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
    },
    {
      value: "indexing",
      label: tabLabel("indexing", t("Indexing")),
      content: <CrawlerCategoryPanel category="indexing" />,
    },
    {
      value: "training",
      label: tabLabel("training", t("Training")),
      content: <CrawlerCategoryPanel category="training" />,
    },
  ];

  return (
    <StandardSectionTabs
      defaultValue="ai_answers"
      tabs={tabs}
      expandable={false}
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