import { TimeBucket } from "@rybbit/shared";
import { useQuery } from "@tanstack/react-query";
import type { BotCategoryFilter } from "../../../../app/[site]/bots/botsStore";
import { useStore } from "../../../../lib/store";
import { APIResponse } from "../../../types";
import { buildApiParams } from "../../../utils";
import { fetchBotTimeSeries, GetBotTimeSeriesResponse } from "../../endpoints";

/** Time series broken down by crawler UA pattern (for multi-line provider charts). */
export function useGetBotTimeSeriesByCrawler({
  site,
  category,
  bucket,
}: {
  site: number | string;
  category: BotCategoryFilter;
  bucket?: TimeBucket;
}) {
  const { time, bucket: storeBucket, timezone } = useStore();
  const bucketToUse = bucket || storeBucket;
  const params = buildApiParams(time, { filters: [] });

  return useQuery<APIResponse<GetBotTimeSeriesResponse>>({
    queryKey: ["bot-time-series-crawler", time, bucketToUse, site, category, timezone],
    queryFn: () =>
      fetchBotTimeSeries(site, {
        ...params,
        bucket: bucketToUse,
        category: category === "all" ? null : category,
        groupBy: "crawler",
      }).then(data => ({ data })),
    staleTime: 60_000,
    enabled: !!site,
  });
}
