import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { CommonApiParams } from "../analytics/endpoints/types";
import { buildApiParams } from "../utils";
import {
  connectStripeRevenue,
  disconnectStripeRevenue,
  syncStripeRevenue,
  fetchRevenueByDimension,
  fetchRevenueOverview,
  fetchRevenueTimeSeries,
  fetchStripeRevenueStatus,
} from "./endpoints";
import { useStore, getTimezone } from "../../lib/store";
import { REVENUE_ATTRIBUTION } from "../../lib/const";

function revenueTimeRange(params: CommonApiParams): { startTime: string; endTime: string } {
  if (params.startDateTime && params.endDateTime) {
    return { startTime: params.startDateTime, endTime: params.endDateTime };
  }

  if (params.pastMinutesStart !== undefined) {
    const end = DateTime.utc();
    const start = end.minus({ minutes: params.pastMinutesStart });
    return {
      startTime: start.toFormat("yyyy-MM-dd HH:mm:ss"),
      endTime: end.toFormat("yyyy-MM-dd HH:mm:ss"),
    };
  }

  const start = DateTime.fromISO(params.startDate, { zone: params.timeZone }).startOf("day");
  const end = DateTime.fromISO(params.endDate, { zone: params.timeZone }).endOf("day");
  return {
    startTime: start.toUTC().toFormat("yyyy-MM-dd HH:mm:ss"),
    endTime: end.toUTC().toFormat("yyyy-MM-dd HH:mm:ss"),
  };
}

export function useStripeRevenueStatus() {
  const { site } = useStore();
  return useQuery({
    queryKey: ["stripe-revenue-status", site],
    queryFn: () => fetchStripeRevenueStatus(site!),
    enabled: Boolean(site),
  });
}

export function useConnectStripeRevenue() {
  const queryClient = useQueryClient();
  const { site } = useStore();
  return useMutation({
    mutationFn: (input: { restrictedKey: string; webhookSecret?: string }) =>
      connectStripeRevenue(site!, input.restrictedKey, input.webhookSecret),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stripe-revenue-status", site] });
      queryClient.invalidateQueries({ queryKey: ["revenue-overview"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-time-series"] });
    },
  });
}

export function useDisconnectStripeRevenue() {
  const queryClient = useQueryClient();
  const { site } = useStore();
  return useMutation({
    mutationFn: () => disconnectStripeRevenue(site!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stripe-revenue-status", site] }),
  });
}

export function useSyncStripeRevenue() {
  const queryClient = useQueryClient();
  const { site } = useStore();
  return useMutation({
    mutationFn: () => syncStripeRevenue(site!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stripe-revenue-status", site] });
      queryClient.invalidateQueries({ queryKey: ["revenue-overview", site] });
      queryClient.invalidateQueries({ queryKey: ["revenue-time-series", site] });
    },
  });
}

export function useRevenueOverview() {
  const { site, time } = useStore();
  const { startTime, endTime } = revenueTimeRange(buildApiParams(time, { filters: undefined }));

  return useQuery({
    queryKey: ["revenue-overview", site, time],
    queryFn: () => fetchRevenueOverview(site!, startTime, endTime),
    enabled: Boolean(site) && REVENUE_ATTRIBUTION,
  });
}

export function useRevenueTimeSeries() {
  const { site, time, bucket } = useStore();
  const params = buildApiParams(time, { filters: undefined });
  const { startTime, endTime } = revenueTimeRange(params);
  const timeZone = getTimezone();

  return useQuery({
    queryKey: ["revenue-time-series", site, time, bucket],
    queryFn: () => fetchRevenueTimeSeries(site!, startTime, endTime, bucket, timeZone),
    enabled: Boolean(site) && REVENUE_ATTRIBUTION,
  });
}

const REVENUE_DIMENSIONS = new Set([
  "channel",
  "referrer",
  "pathname",
  "country",
  "device_type",
  "browser",
  "operating_system",
]);

/** Map of dimension value → revenue cents for the current time range. */
export function useRevenueByDimension(parameter: string | undefined) {
  const { site, time } = useStore();
  const { startTime, endTime } = revenueTimeRange(buildApiParams(time, { filters: undefined }));
  const enabled =
    Boolean(site) && REVENUE_ATTRIBUTION && Boolean(parameter) && REVENUE_DIMENSIONS.has(parameter!);

  const query = useQuery({
    queryKey: ["revenue-by-dimension", site, time, parameter],
    queryFn: () => fetchRevenueByDimension(site!, startTime, endTime, parameter!),
    enabled,
    staleTime: 60_000,
  });

  const byValue = new Map<string, number>();
  for (const row of query.data ?? []) {
    byValue.set(row.value, row.revenue_cents);
  }

  return { ...query, byValue };
}