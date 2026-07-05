import { authedFetch } from "../utils";

export interface StripeRevenueStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  restrictedKeyUrl: string;
}

export interface RevenueOverviewResponse {
  totals: {
    revenue_cents: number;
    payment_count: number;
    paying_users: number;
  };
  byChannel: Array<{
    channel: string;
    revenue_cents: number;
    payment_count: number;
    visitors: number;
  }>;
}

export async function fetchStripeRevenueStatus(siteId: string | number) {
  return authedFetch<StripeRevenueStatus>(`/sites/${siteId}/revenue/status`);
}

export async function connectStripeRevenue(
  siteId: string | number,
  restrictedKey: string,
  webhookSecret?: string
) {
  return authedFetch<{ success: boolean }>(`/sites/${siteId}/revenue/stripe/connect`, {
    method: "POST",
    body: JSON.stringify({ restrictedKey, webhookSecret }),
  });
}

export async function disconnectStripeRevenue(siteId: string | number) {
  return authedFetch<{ success: boolean }>(`/sites/${siteId}/revenue/stripe/connect`, {
    method: "DELETE",
  });
}

export async function fetchRevenueOverview(siteId: string | number, startTime: string, endTime: string) {
  const params = new URLSearchParams({ startTime, endTime });
  const response = await authedFetch<{ data: RevenueOverviewResponse }>(
    `/sites/${siteId}/revenue/overview?${params.toString()}`
  );
  return response.data;
}

export type RevenueTimeSeriesPoint = {
  time: string;
  revenue_cents: number;
  payment_count: number;
};

export async function fetchRevenueTimeSeries(
  siteId: string | number,
  startTime: string,
  endTime: string,
  bucket: string,
  timeZone: string
) {
  const params = new URLSearchParams({ startTime, endTime, bucket, time_zone: timeZone });
  const response = await authedFetch<{ data: RevenueTimeSeriesPoint[] }>(
    `/sites/${siteId}/revenue/time-series?${params.toString()}`
  );
  return response.data;
}