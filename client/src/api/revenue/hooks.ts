import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { CommonApiParams } from "../analytics/endpoints/types";
import { buildApiParams } from "../utils";
import {
  connectStripeRevenue,
  disconnectStripeRevenue,
  fetchRevenueOverview,
  fetchStripeRevenueStatus,
} from "./endpoints";
import { useStore } from "../../lib/store";

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stripe-revenue-status", site] }),
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

export function useRevenueOverview() {
  const { site, time } = useStore();
  const { startTime, endTime } = revenueTimeRange(buildApiParams(time, { filters: undefined }));

  return useQuery({
    queryKey: ["revenue-overview", site, time],
    queryFn: () => fetchRevenueOverview(site!, startTime, endTime),
    enabled: Boolean(site),
  });
}