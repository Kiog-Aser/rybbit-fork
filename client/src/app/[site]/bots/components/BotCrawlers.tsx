"use client";

import NumberFlow from "@number-flow/react";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useGetBotDimension } from "../../../../api/analytics/hooks/bots/useGetBotDimension";
import { Card, CardContent, CardLoader } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Skeleton } from "../../../../components/ui/skeleton";
import { getCrawlerBrandStyle, getCrawlerDisplayName } from "../../../../lib/botCrawlerNames";
import { useStore } from "../../../../lib/store";

export function BotCrawlers() {
  const { site } = useStore();
  const [query, setQuery] = useState("");
  const { data, isLoading, isFetching } = useGetBotDimension({
    site,
    dimension: "matched_ua_pattern",
    limit: 50,
    page: 1,
  });

  const crawlers = useMemo(() => {
    const items = data?.data?.data.filter(item => item.value && item.value !== "") ?? [];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? items.filter(item => getCrawlerDisplayName(item.value).toLowerCase().includes(needle))
      : items;

    return filtered.slice(0, 12);
  }, [data?.data?.data, query]);

  return (
    <Card>
      {isFetching && <CardLoader />}
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Search crawlers</h3>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search crawlers"
              className="pl-8 h-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : crawlers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No crawler traffic in this period yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {crawlers.map(item => {
              const label = getCrawlerDisplayName(item.value);
              const brand = getCrawlerBrandStyle(label);

              return (
                <div
                  key={item.value}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                  style={{ backgroundColor: brand.background }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base leading-none">{brand.emoji}</span>
                    <span className="text-sm font-medium truncate" style={{ color: brand.foreground }}>
                      {label}
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