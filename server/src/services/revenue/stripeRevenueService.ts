import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { db } from "../../db/postgres/postgres.js";
import { siteStripeConnections } from "../../db/postgres/schema.js";
import { decryptSecret, encryptSecret } from "../../lib/revenueEncryption.js";

// Stripe's restricted-key creator uses rak_* permission slugs (same flow as DataFast).
const STRIPE_RAK_PERMISSIONS = [
  "rak_charge_read",
  "rak_subscription_read",
  "rak_customer_read",
  "rak_payment_intent_read",
  "rak_checkout_session_read",
  "rak_invoice_read",
  "rak_webhook_write",
  "rak_product_read",
] as const;

const stripeRestrictedKeyParams = new URLSearchParams();
stripeRestrictedKeyParams.set("name", "Rybbit Revenue");
for (const permission of STRIPE_RAK_PERMISSIONS) {
  stripeRestrictedKeyParams.append("permissions[]", permission);
}

export const STRIPE_RESTRICTED_KEY_URL = `https://dashboard.stripe.com/apikeys/create?${stripeRestrictedKeyParams.toString()}`;

export interface RevenueOverviewRow {
  channel: string;
  revenue_cents: number;
  payment_count: number;
  visitors: number;
}

export async function getSiteStripeConnection(siteId: number) {
  const [row] = await db.select().from(siteStripeConnections).where(eq(siteStripeConnections.siteId, siteId)).limit(1);
  return row ?? null;
}

export async function connectSiteStripe(siteId: number, restrictedKey: string, webhookSecret?: string) {
  if (!restrictedKey.startsWith("rk_live_") && !restrictedKey.startsWith("rk_test_")) {
    throw new Error("Stripe restricted key must start with rk_live_ or rk_test_");
  }

  const stripe = new Stripe(restrictedKey, { typescript: true, maxNetworkRetries: 2 });
  // Validate with charge read — restricted keys do not include balance access.
  await stripe.charges.list({ limit: 1 });

  const encrypted = encryptSecret(restrictedKey);
  await db
    .insert(siteStripeConnections)
    .values({
      siteId,
      restrictedKeyEncrypted: encrypted,
      webhookSecret: webhookSecret || null,
    })
    .onConflictDoUpdate({
      target: siteStripeConnections.siteId,
      set: {
        restrictedKeyEncrypted: encrypted,
        webhookSecret: webhookSecret || null,
        connectedAt: new Date().toISOString(),
      },
    });
}

export async function disconnectSiteStripe(siteId: number) {
  await db.delete(siteStripeConnections).where(eq(siteStripeConnections.siteId, siteId));
}

export async function recordRevenueEvent(input: {
  siteId: number;
  stripePaymentId: string;
  amountCents: number;
  currency: string;
  status: string;
  sessionId?: string;
  userId?: string;
  referrer?: string;
  channel?: string;
  pathname?: string;
  customerEmailHash?: string;
  timestamp?: Date;
}) {
  const timestamp = input.timestamp ?? new Date();
  await clickhouse.insert({
    table: "revenue_events",
    values: [
      {
        site_id: input.siteId,
        timestamp,
        stripe_payment_id: input.stripePaymentId,
        amount_cents: input.amountCents,
        currency: input.currency.toLowerCase(),
        status: input.status,
        session_id: input.sessionId ?? "",
        user_id: input.userId ?? "",
        referrer: input.referrer ?? "",
        channel: input.channel ?? "",
        pathname: input.pathname ?? "",
        customer_email_hash: input.customerEmailHash ?? "",
      },
    ],
    format: "JSONEachRow",
  });
}

export async function getRevenueOverview(siteId: number, startTime: string, endTime: string): Promise<RevenueOverviewRow[]> {
  const result = await clickhouse.query({
    query: `
      SELECT
        if(channel = '', 'direct', channel) AS channel,
        sum(amount_cents) AS revenue_cents,
        count() AS payment_count,
        uniqExact(user_id) AS visitors
      FROM revenue_events
      WHERE site_id = {siteId:UInt16}
        AND timestamp >= parseDateTimeBestEffort({startTime:String})
        AND timestamp <= parseDateTimeBestEffort({endTime:String})
        AND status = 'succeeded'
      GROUP BY channel
      ORDER BY revenue_cents DESC
      LIMIT 50
    `,
    query_params: { siteId, startTime, endTime },
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as RevenueOverviewRow[];
  return rows;
}

export type RevenueTimeSeriesRow = {
  time: string;
  revenue_cents: number;
  payment_count: number;
};

export async function getRevenueTimeSeries(
  siteId: number,
  startTime: string,
  endTime: string,
  bucketFn: string,
  timeZone: string
): Promise<RevenueTimeSeriesRow[]> {
  const result = await clickhouse.query({
    query: `
      SELECT
        toDateTime(${bucketFn}(toTimeZone(timestamp, {timeZone:String}))) AS time,
        sum(amount_cents) AS revenue_cents,
        count() AS payment_count
      FROM revenue_events
      WHERE site_id = {siteId:UInt16}
        AND timestamp >= parseDateTimeBestEffort({startTime:String})
        AND timestamp <= parseDateTimeBestEffort({endTime:String})
        AND status = 'succeeded'
      GROUP BY time
      ORDER BY time
    `,
    query_params: { siteId, startTime, endTime, timeZone },
    format: "JSONEachRow",
  });
  return (await result.json()) as RevenueTimeSeriesRow[];
}

export async function getRevenueTotals(siteId: number, startTime: string, endTime: string) {
  const result = await clickhouse.query({
    query: `
      SELECT
        sum(amount_cents) AS revenue_cents,
        count() AS payment_count,
        uniqExact(user_id) AS paying_users
      FROM revenue_events
      WHERE site_id = {siteId:UInt16}
        AND timestamp >= parseDateTimeBestEffort({startTime:String})
        AND timestamp <= parseDateTimeBestEffort({endTime:String})
        AND status = 'succeeded'
    `,
    query_params: { siteId, startTime, endTime },
    format: "JSONEachRow",
  });
  const [row] = (await result.json()) as Array<{
    revenue_cents: number;
    payment_count: number;
    paying_users: number;
  }>;
  return row ?? { revenue_cents: 0, payment_count: 0, paying_users: 0 };
}

export function getStripeClientForSite(connection: { restrictedKeyEncrypted: string }) {
  const key = decryptSecret(connection.restrictedKeyEncrypted);
  return new Stripe(key, { typescript: true, maxNetworkRetries: 2 });
}

export function extractAttributionFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  return {
    sessionId: metadata?.rybbit_session_id || metadata?.datafast_session_id || "",
    userId: metadata?.rybbit_user_id || metadata?.datafast_user_id || "",
    referrer: metadata?.rybbit_referrer || metadata?.datafast_referrer || "",
    channel: metadata?.rybbit_channel || metadata?.datafast_channel || "",
    pathname: metadata?.rybbit_pathname || metadata?.datafast_pathname || "",
  };
}