import { TimeBucket } from "@rybbit/shared";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "../../../../lib/store";
import { APIResponse } from "../../../types";
import { buildApiParams } from "../../../utils";
import { fetchBotTimeSeries, GetBotTimeSeriesResponse } from "../../endpoints";
import type { BotCategoryFilter } from "../../../../app/[site]/bots/botsStore";

export function useGetBotTimeSeriesByCategory({
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
    queryKey: ["bot-time-series-category", time, bucketToUse, site, category, timezone],
    queryFn: () =>
      fetchBotTimeSeries(site, { ...params, bucket: bucketToUse, category }).then(data => ({ data })),
    staleTime: 60_000,
    enabled: !!site && category !== "all",
  });
}