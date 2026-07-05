import { FastifyReply, FastifyRequest } from "fastify";
import { TimeBucketToFn } from "../analytics/utils/utils.js";
import { TimeBucket } from "../analytics/types.js";
import { ensureStripeRevenueSynced, getRevenueTimeSeries } from "../../services/revenue/stripeRevenueService.js";

export async function getRevenueTimeSeriesHandler(
  request: FastifyRequest<{
    Params: { siteId: string };
    Querystring: { startTime?: string; endTime?: string; bucket?: TimeBucket; time_zone?: string };
  }>,
  reply: FastifyReply
) {
  const siteId = Number(request.params.siteId);
  const { startTime, endTime, bucket = "hour", time_zone: timeZone = "UTC" } = request.query;

  if (!startTime || !endTime) {
    return reply.status(400).send({ error: "startTime and endTime are required" });
  }

  const bucketFn = TimeBucketToFn[bucket];
  if (!bucketFn) {
    return reply.status(400).send({ error: `Invalid bucket value: ${bucket}` });
  }

  await ensureStripeRevenueSynced(siteId);

  const data = await getRevenueTimeSeries(siteId, startTime, endTime, bucketFn, timeZone);
  return reply.send({ data });
}