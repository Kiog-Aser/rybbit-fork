import { FilterParams } from "@rybbit/shared";
import { FastifyReply, FastifyRequest } from "fastify";
import SqlString from "sqlstring";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { TimeBucket } from "../types.js";
import { getTimeStatement, processResults, TimeBucketToFn } from "../utils/utils.js";
import {
  type BotLayerKey,
  getBotCategoryStatement,
  getBotFilterStatement,
  getBotLayerStatement,
  getBotTimeStatementFill,
} from "./utils.js";

type BotTimeSeriesPoint = {
  time: string;
  bot_requests: number;
  crawler?: string;
};

export interface BotTimeSeriesRequest {
  Params: {
    siteId: string;
  };
  Querystring: FilterParams<{
    bucket: TimeBucket;
    layer?: BotLayerKey;
    category?: string;
    /** When "crawler", return one row per (time, matched_ua_pattern). */
    groupBy?: string;
  }>;
}

const getQuery = (params: BotTimeSeriesRequest["Querystring"]) => {
  const { bucket = "hour", time_zone, groupBy } = params;
  const timeStatement = getTimeStatement(params);
  const filterStatement = getBotFilterStatement(params.filters);
  const layerStatement = getBotLayerStatement(params.layer);
  const categoryStatement = getBotCategoryStatement(params.category);
  const hasBoundedTime =
    Boolean(params.start_date && params.end_date) ||
    Boolean(params.start_datetime && params.end_datetime) ||
    (params.past_minutes_start !== undefined && params.past_minutes_end !== undefined);
  // WITH FILL only works for single-series aggregates
  const fillClause =
    groupBy !== "crawler" && hasBoundedTime ? getBotTimeStatementFill(params, bucket) : "";
  const timezone = SqlString.escape(time_zone || "UTC");
  const byCrawler = groupBy === "crawler";

  if (byCrawler) {
    return `
      SELECT
        toDateTime(${TimeBucketToFn[bucket]}(toTimeZone(timestamp, ${timezone}))) AS time,
        matched_ua_pattern AS crawler,
        count() AS bot_requests
      FROM bot_events
      WHERE site_id = {siteId:Int32}
        AND detected_ua_pattern
        AND matched_ua_pattern != ''
        ${filterStatement}
        ${layerStatement}
        ${categoryStatement}
        ${timeStatement}
      GROUP BY time, crawler
      ORDER BY time, bot_requests DESC
    `;
  }

  return `
    SELECT
      toDateTime(${TimeBucketToFn[bucket]}(toTimeZone(timestamp, ${timezone}))) AS time,
      count() AS bot_requests
    FROM bot_events
    WHERE site_id = {siteId:Int32}
      ${filterStatement}
      ${layerStatement}
      ${categoryStatement}
      ${timeStatement}
    GROUP BY time
    ORDER BY time ${fillClause}
  `;
};

export async function getBotTimeSeries(req: FastifyRequest<BotTimeSeriesRequest>, res: FastifyReply) {
  try {
    const result = await clickhouse.query({
      query: getQuery(req.query),
      format: "JSONEachRow",
      query_params: {
        siteId: Number(req.params.siteId),
      },
    });

    const data = await processResults<BotTimeSeriesPoint>(result);
    return res.send({ data });
  } catch (error) {
    console.error("Error fetching bot time series:", error);
    return res.status(500).send({ error: "Failed to fetch bot time series" });
  }
}
