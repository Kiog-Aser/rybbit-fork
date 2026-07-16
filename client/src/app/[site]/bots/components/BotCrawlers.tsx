"use client";

import NumberFlow from "@number-flow/react";
import { useExtracted } from "next-intl";
import { useGetBotDimension } from "../../../../api/analytics/hooks/bots/useGetBotDimension";
import { CrawlerLogo } from "../../../../components/CrawlerLogo";
import { Card, CardContent, CardLoader } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { aggregateCrawlerRows, getCrawlerBrandStyle } from "../../../../lib/botCrawlerNames";
import { useStore } from "../../../../lib/store";

export function BotCrawlers() {
  const t = useExtracted();
  const { site } = useStore();
  const { data, isLoading, isFetching } = useGetBotDimension({
    site,
    dimension: "matched_ua_pattern",
    limit: 50,
    page: 1,
  });

  const crawlers = aggregateCrawlerRows(
    data?.data?.data.filter(item => item.value && item.value !== "") ?? [],
    "all"
  );

  return (
    <Card>
      {isFetching && <CardLoader />}
      <CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t("Crawlers")}</h3>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : crawlers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t("No crawler traffic in this period yet.")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {crawlers.map(item => {
              const brand = getCrawlerBrandStyle(item.label);

              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                  style={{ backgroundColor: brand.background }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CrawlerLogo label={item.label} size={18} />
                    <span className="text-sm font-medium truncate" style={{ color: brand.foreground }}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: brand.foreground }}>
                    <NumberFlow respectMotionPreference={false} value={item.count} format={{ notation: "compact" }} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}