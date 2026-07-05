import { FastifyReply, FastifyRequest } from "fastify";
import {
  ensureStripeRevenueSynced,
  getRevenueOverview,
  getRevenueTotals,
} from "../../services/revenue/stripeRevenueService.js";

export async function getRevenueOverviewHandler(
  request: FastifyRequest<{
    Params: { siteId: string };
    Querystring: { startTime?: string; endTime?: string };
  }>,
  reply: FastifyReply
) {
  const siteId = Number(request.params.siteId);
  const startTime = request.query.startTime;
  const endTime = request.query.endTime;

  if (!startTime || !endTime) {
    return reply.status(400).send({ error: "startTime and endTime are required" });
  }

  await ensureStripeRevenueSynced(siteId);

  const [totals, byChannel] = await Promise.all([
    getRevenueTotals(siteId, startTime, endTime),
    getRevenueOverview(siteId, startTime, endTime),
  ]);

  return reply.send({
    data: {
      totals,
      byChannel,
    },
  });
}