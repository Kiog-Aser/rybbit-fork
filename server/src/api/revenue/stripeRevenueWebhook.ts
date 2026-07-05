import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { db } from "../../db/postgres/postgres.js";
import { siteStripeConnections } from "../../db/postgres/schema.js";
import {
  extractAttributionFromMetadata,
  getStripeClientForSite,
  recordRevenueEvent,
} from "../../services/revenue/stripeRevenueService.js";

async function handlePayment(
  siteId: number,
  paymentId: string,
  amountCents: number,
  currency: string,
  status: string,
  metadata: Stripe.Metadata | null | undefined,
  customerEmail?: string | null
) {
  const attribution = extractAttributionFromMetadata(metadata);
  const customerEmailHash = customerEmail
    ? createHash("sha256").update(customerEmail.trim().toLowerCase()).digest("hex")
    : "";

  await recordRevenueEvent({
    siteId,
    stripePaymentId: paymentId,
    amountCents,
    currency,
    status,
    ...attribution,
    customerEmailHash,
  });
}

export async function stripeRevenueWebhook(
  request: FastifyRequest<{ Params: { siteId: string } }>,
  reply: FastifyReply
) {
  const siteId = Number(request.params.siteId);
  const [connection] = await db
    .select()
    .from(siteStripeConnections)
    .where(eq(siteStripeConnections.siteId, siteId))
    .limit(1);

  if (!connection) {
    return reply.status(404).send({ error: "Stripe not connected for this site" });
  }

  const signature = request.headers["stripe-signature"];
  if (!signature || !connection.webhookSecret) {
    return reply.status(400).send({ error: "Missing Stripe webhook signature or site webhook secret" });
  }

  const stripe = getStripeClientForSite(connection);
  const rawBody = (request.raw as { body?: Buffer }).body;
  if (!rawBody) {
    return reply.status(400).send({ error: "Missing raw body" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, connection.webhookSecret);
  } catch (error) {
    return reply.status(400).send({
      error: error instanceof Error ? error.message : "Invalid webhook signature",
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid" && session.amount_total != null) {
          await handlePayment(
            siteId,
            String(session.payment_intent || session.id),
            session.amount_total,
            session.currency || "usd",
            "succeeded",
            session.metadata,
            session.customer_details?.email
          );
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePayment(
          siteId,
          paymentIntent.id,
          paymentIntent.amount_received,
          paymentIntent.currency,
          "succeeded",
          paymentIntent.metadata,
          typeof paymentIntent.receipt_email === "string" ? paymentIntent.receipt_email : null
        );
        break;
      }
      default:
        break;
    }

    await db
      .update(siteStripeConnections)
      .set({ lastSyncAt: new Date().toISOString() })
      .where(eq(siteStripeConnections.siteId, siteId));

    return reply.send({ received: true });
  } catch (error) {
    request.log.error({ err: error, siteId }, "Stripe revenue webhook failed");
    return reply.status(500).send({ error: "Webhook processing failed" });
  }
}