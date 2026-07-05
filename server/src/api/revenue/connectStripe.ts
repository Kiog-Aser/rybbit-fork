import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { REVENUE_ATTRIBUTION } from "../../lib/const.js";
import {
  backfillStripeRevenue,
  connectSiteStripe,
  disconnectSiteStripe,
  getSiteStripeConnection,
  reconcileStripeRevenue,
  STRIPE_RESTRICTED_KEY_URL,
} from "../../services/revenue/stripeRevenueService.js";

const connectSchema = z.object({
  restrictedKey: z.string().min(10),
  webhookSecret: z.string().optional(),
});

export async function getStripeRevenueStatus(request: FastifyRequest<{ Params: { siteId: string } }>, reply: FastifyReply) {
  if (!REVENUE_ATTRIBUTION) {
    return reply.status(404).send({ error: "Revenue attribution is disabled" });
  }

  const siteId = Number(request.params.siteId);
  const connection = await getSiteStripeConnection(siteId);

  return reply.send({
    connected: Boolean(connection),
    connectedAt: connection?.connectedAt ?? null,
    lastSyncAt: connection?.lastSyncAt ?? null,
    restrictedKeyUrl: STRIPE_RESTRICTED_KEY_URL,
  });
}

export async function connectStripeRevenue(
  request: FastifyRequest<{ Params: { siteId: string }; Body: unknown }>,
  reply: FastifyReply
) {
  if (!REVENUE_ATTRIBUTION) {
    return reply.status(404).send({ error: "Revenue attribution is disabled" });
  }

  const parsed = connectSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const siteId = Number(request.params.siteId);
  try {
    await connectSiteStripe(siteId, parsed.data.restrictedKey, parsed.data.webhookSecret);
    return reply.send({ success: true, backfilled: true });
  } catch (error) {
    return reply.status(400).send({
      error: error instanceof Error ? error.message : "Failed to connect Stripe",
    });
  }
}

export async function syncStripeRevenue(
  request: FastifyRequest<{ Params: { siteId: string } }>,
  reply: FastifyReply
) {
  if (!REVENUE_ATTRIBUTION) {
    return reply.status(404).send({ error: "Revenue attribution is disabled" });
  }

  const siteId = Number(request.params.siteId);
  const connection = await getSiteStripeConnection(siteId);
  if (!connection) {
    return reply.status(400).send({ error: "Stripe is not connected for this site" });
  }

  try {
    const imported = await reconcileStripeRevenue(siteId, 90);
    return reply.send({ success: true, imported });
  } catch (error) {
    return reply.status(400).send({
      error: error instanceof Error ? error.message : "Failed to sync Stripe revenue",
    });
  }
}

export async function disconnectStripeRevenue(request: FastifyRequest<{ Params: { siteId: string } }>, reply: FastifyReply) {
  if (!REVENUE_ATTRIBUTION) {
    return reply.status(404).send({ error: "Revenue attribution is disabled" });
  }

  const siteId = Number(request.params.siteId);
  await disconnectSiteStripe(siteId);
  return reply.send({ success: true });
}