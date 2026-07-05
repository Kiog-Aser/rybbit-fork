import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildApiParams } from "../utils";
import {
  connectStripeRevenue,
  disconnectStripeRevenue,
  fetchRevenueOverview,
  fetchStripeRevenueStatus,
} from "./endpoints";
import { useStore } from "../../lib/store";

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
  const params = buildApiParams(time, { filters: undefined });
  const startTime = params.startTime;
  const endTime = params.endTime;

  return useQuery({
    queryKey: ["revenue-overview", site, time],
    queryFn: () => fetchRevenueOverview(site!, startTime, endTime),
    enabled: Boolean(site),
  });
}