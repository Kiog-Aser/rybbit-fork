import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import Stripe from "stripe";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { db } from "../../db/postgres/postgres.js";
import { siteStripeConnections } from "../../db/postgres/schema.js";
import { createServiceLogger } from "../../lib/logger/logger.js";
import { decryptSecret, encryptSecret } from "../../lib/revenueEncryption.js";

const revenueLogger = createServiceLogger("stripe-revenue");
const revenueSyncLastRun = new Map<number, number>();
const REVENUE_SYNC_COOLDOWN_MS = 2 * 60 * 1000;

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

export async function revenuePaymentExists(siteId: number, stripePaymentId: string): Promise<boolean> {
  const result = await clickhouse.query({
    query: `
      SELECT 1
      FROM revenue_events
      WHERE site_id = {siteId:UInt16}
        AND stripe_payment_id = {stripePaymentId:String}
      LIMIT 1
    `,
    query_params: { siteId, stripePaymentId },
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as unknown[];
  return rows.length > 0;
}

async function importStripePaymentsSince(siteId: number, sinceUnix: number): Promise<number> {
  const connection = await getSiteStripeConnection(siteId);
  if (!connection) return 0;

  const stripe = getStripeClientForSite(connection);
  let imported = 0;

  for await (const paymentIntent of stripe.paymentIntents.list({
    created: { gte: sinceUnix },
    limit: 100,
  })) {
    if (paymentIntent.status !== "succeeded" || paymentIntent.amount_received <= 0) continue;
    if (await revenuePaymentExists(siteId, paymentIntent.id)) continue;

    const attribution = extractAttributionFromMetadata(paymentIntent.metadata);
    const receiptEmail =
      typeof paymentIntent.receipt_email === "string" ? paymentIntent.receipt_email : null;
    const customerEmailHash = receiptEmail
      ? createHash("sha256").update(receiptEmail.trim().toLowerCase()).digest("hex")
      : "";

    await recordRevenueEvent({
      siteId,
      stripePaymentId: paymentIntent.id,
      amountCents: paymentIntent.amount_received,
      currency: paymentIntent.currency,
      status: "succeeded",
      ...attribution,
      customerEmailHash,
      timestamp: new Date(paymentIntent.created * 1000),
    });
    imported++;
  }

  await db
    .update(siteStripeConnections)
    .set({ lastSyncAt: new Date().toISOString() })
    .where(eq(siteStripeConnections.siteId, siteId));

  return imported;
}

export async function backfillStripeRevenue(siteId: number, days = 90): Promise<number> {
  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  return importStripePaymentsSince(siteId, since);
}

/** Wipe duplicate-prone rows in the window and re-import canonical PaymentIntents only. */
export async function reconcileStripeRevenue(siteId: number, days = 90): Promise<number> {
  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  const sinceFormatted = DateTime.fromSeconds(since).toUTC().toFormat("yyyy-MM-dd HH:mm:ss");

  await clickhouse.command({
    query: `
      ALTER TABLE revenue_events
      DELETE WHERE site_id = {siteId:UInt16}
        AND timestamp >= parseDateTimeBestEffort({since:String})
    `,
    query_params: { siteId, since: sinceFormatted },
  });

  return importStripePaymentsSince(siteId, since);
}

export async function syncStripeRevenueIncremental(siteId: number): Promise<number> {
  const connection = await getSiteStripeConnection(siteId);
  if (!connection) return 0;

  const since = connection.lastSyncAt
    ? Math.floor(new Date(connection.lastSyncAt).getTime() / 1000) - 86_400
    : Math.floor(Date.now() / 1000) - 90 * 86_400;

  return importStripePaymentsSince(siteId, since);
}

/** Pull new Stripe payments before serving revenue stats (rate-limited per site). */
export async function ensureStripeRevenueSynced(siteId: number): Promise<void> {
  const now = Date.now();
  const last = revenueSyncLastRun.get(siteId) ?? 0;
  if (now - last < REVENUE_SYNC_COOLDOWN_MS) return;

  const connection = await getSiteStripeConnection(siteId);
  if (!connection) return;

  revenueSyncLastRun.set(siteId, now);
  try {
    const imported = await syncStripeRevenueIncremental(siteId);
    if (imported > 0) {
      revenueLogger.info({ siteId, imported }, "Auto-synced Stripe revenue");
    }
  } catch (error) {
    revenueLogger.warn({ err: error, siteId }, "Automatic Stripe revenue sync failed");
  }
}

export async function syncAllConnectedStripeSites(): Promise<void> {
  const connections = await db.select({ siteId: siteStripeConnections.siteId }).from(siteStripeConnections);
  for (const { siteId } of connections) {
    try {
      await syncStripeRevenueIncremental(siteId);
    } catch (error) {
      revenueLogger.warn({ err: error, siteId }, "Periodic Stripe revenue sync failed");
    }
  }
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

  await backfillStripeRevenue(siteId, 90);
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
  const timestamp = DateTime.fromJSDate(input.timestamp ?? new Date())
    .toUTC()
    .toFormat("yyyy-MM-dd HH:mm:ss");
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
      FROM (
        SELECT
          stripe_payment_id,
          if(channel = '', 'direct', channel) AS channel,
          max(amount_cents) AS amount_cents,
          any(user_id) AS user_id
        FROM revenue_events
        WHERE site_id = {siteId:UInt16}
          AND timestamp >= parseDateTimeBestEffort({startTime:String})
          AND timestamp <= parseDateTimeBestEffort({endTime:String})
          AND status = 'succeeded'
          AND stripe_payment_id LIKE 'pi_%'
        GROUP BY stripe_payment_id, channel
      )
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
        time,
        sum(amount_cents) AS revenue_cents,
        count() AS payment_count
      FROM (
        SELECT
          toDateTime(${bucketFn}(toTimeZone(timestamp, {timeZone:String}))) AS time,
          stripe_payment_id,
          max(amount_cents) AS amount_cents
        FROM revenue_events
        WHERE site_id = {siteId:UInt16}
          AND timestamp >= parseDateTimeBestEffort({startTime:String})
          AND timestamp <= parseDateTimeBestEffort({endTime:String})
          AND status = 'succeeded'
          AND stripe_payment_id LIKE 'pi_%'
        GROUP BY time, stripe_payment_id
      )
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
        uniqExactIf(customer_email_hash, customer_email_hash != '') AS paying_users
      FROM (
        SELECT
          stripe_payment_id,
          max(amount_cents) AS amount_cents,
          any(customer_email_hash) AS customer_email_hash
        FROM revenue_events
        WHERE site_id = {siteId:UInt16}
          AND timestamp >= parseDateTimeBestEffort({startTime:String})
          AND timestamp <= parseDateTimeBestEffort({endTime:String})
          AND status = 'succeeded'
          AND stripe_payment_id LIKE 'pi_%'
        GROUP BY stripe_payment_id
      )
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

export type RevenueDimensionKey =
  | "channel"
  | "referrer"
  | "pathname"
  | "country"
  | "device_type"
  | "browser"
  | "operating_system";

export type RevenueByDimensionRow = {
  value: string;
  revenue_cents: number;
  payment_count: number;
};

/**
 * Revenue totals broken down by a traffic dimension.
 * channel / referrer / pathname come from revenue_events attribution metadata.
 * country / device / browser / OS are joined via session_id → events.
 */
export async function getRevenueByDimension(
  siteId: number,
  startTime: string,
  endTime: string,
  dimension: RevenueDimensionKey
): Promise<RevenueByDimensionRow[]> {
  const nativeColumns: RevenueDimensionKey[] = ["channel", "referrer", "pathname"];

  let dimExpr: string;
  let needsSessionJoin = false;

  if (nativeColumns.includes(dimension)) {
    if (dimension === "channel") {
      dimExpr = `if(channel = '', 'direct', channel)`;
    } else if (dimension === "referrer") {
      dimExpr = `if(referrer = '', 'direct', domainWithoutWWW(referrer))`;
    } else {
      dimExpr = `if(pathname = '', '/', pathname)`;
    }
  } else {
    needsSessionJoin = true;
    dimExpr = `if(session_dim = '', 'unknown', session_dim)`;
  }

  const sessionJoin =
    needsSessionJoin
      ? `
      LEFT JOIN (
        SELECT
          session_id,
          any(${dimension === "country" ? "country" : dimension}) AS session_dim
        FROM events
        WHERE site_id = {siteId:UInt16}
          AND timestamp >= parseDateTimeBestEffort({startTime:String}) - INTERVAL 30 DAY
          AND timestamp <= parseDateTimeBestEffort({endTime:String})
        GROUP BY session_id
      ) s ON payments.session_id = s.session_id
    `
      : "";

  const valueSelect = needsSessionJoin
    ? dimExpr
    : dimExpr;

  const result = await clickhouse.query({
    query: `
      SELECT
        ${valueSelect} AS value,
        sum(amount_cents) AS revenue_cents,
        count() AS payment_count
      FROM (
        SELECT
          stripe_payment_id,
          max(amount_cents) AS amount_cents,
          any(session_id) AS session_id,
          any(channel) AS channel,
          any(referrer) AS referrer,
          any(pathname) AS pathname
        FROM revenue_events
        WHERE site_id = {siteId:UInt16}
          AND timestamp >= parseDateTimeBestEffort({startTime:String})
          AND timestamp <= parseDateTimeBestEffort({endTime:String})
          AND status = 'succeeded'
          AND stripe_payment_id LIKE 'pi_%'
        GROUP BY stripe_payment_id
      ) payments
      ${sessionJoin}
      GROUP BY value
      HAVING value != '' AND value != 'unknown'
      ORDER BY revenue_cents DESC
      LIMIT 100
    `,
    query_params: { siteId, startTime, endTime },
    format: "JSONEachRow",
  });

  return (await result.json()) as RevenueByDimensionRow[];
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