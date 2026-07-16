import { FastifyReply, FastifyRequest } from "fastify";
import {
  ensureStripeRevenueSynced,
  getRevenueByDimension,
  type RevenueDimensionKey,
} from "../../services/revenue/stripeRevenueService.js";

const ALLOWED: RevenueDimensionKey[] = [
  "channel",
  "referrer",
  "pathname",
  "country",
  "device_type",
  "browser",
  "operating_system",
];

export async function getRevenueByDimensionHandler(
  request: FastifyRequest<{
    Params: { siteId: string };
    Querystring: { startTime?: string; endTime?: string; parameter?: string };
  }>,
  reply: FastifyReply
) {
  const siteId = Number(request.params.siteId);
  const { startTime, endTime, parameter } = request.query;

  if (!startTime || !endTime) {
    return reply.status(400).send({ error: "startTime and endTime are required" });
  }

  if (!parameter || !ALLOWED.includes(parameter as RevenueDimensionKey)) {
    return reply.status(400).send({
      error: `parameter must be one of: ${ALLOWED.join(", ")}`,
    });
  }

  await ensureStripeRevenueSynced(siteId);

  const data = await getRevenueByDimension(siteId, startTime, endTime, parameter as RevenueDimensionKey);

  return reply.send({ data });
}
