import { FilterParams } from "@rybbit/shared";
import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { getTimeStatement, processResults } from "../utils/utils.js";
import {
  type BotLayerKey,
  getBotCategoryStatement,
  getBotFilterStatement,
  getBotLayerStatement,
  getBotPurposeExpression,
} from "./utils.js";

type BotOverviewResponse = {
  bot_requests: number;
  total_events: number;
  bot_percentage: number;
  ua_pattern: number;
  header_heuristics: number;
  client_signals: number;
  bot_asn: number;
  rate_anomaly: number;
  category_all: number;
  category_ai_answers: number;
  category_indexing: number;
  category_training: number;
};

export interface BotOverviewRequest {
  Params: {
    siteId: string;
  };
  Querystring: FilterParams<{
    layer?: BotLayerKey;
    category?: string;
  }>;
}

const getQuery = (params: BotOverviewRequest["Querystring"]) => {
  const timeStatement = getTimeStatement(params);
  const filterStatement = getBotFilterStatement(params.filters);
  const layerStatement = getBotLayerStatement(params.layer);
  const categoryStatement = getBotCategoryStatement(params.category);

  return `
    WITH
      bot_stats AS (
        SELECT
          count() AS bot_requests,
          countIf(detected_ua_pattern) AS ua_pattern,
          countIf(detected_header_heuristics) AS header_heuristics,
          countIf(detected_client_signals) AS client_signals,
          countIf(detected_bot_asn) AS bot_asn,
          countIf(detected_rate_anomaly) AS rate_anomaly
        FROM bot_events
        WHERE site_id = {siteId:Int32}
          ${filterStatement}
          ${layerStatement}
          ${categoryStatement}
          ${timeStatement}
      ),
      all_bot_stats AS (
        SELECT count() AS all_bot_requests
        FROM bot_events
        WHERE site_id = {siteId:Int32}
          ${filterStatement}
          ${categoryStatement}
          ${timeStatement}
      ),
      event_stats AS (
        SELECT count() AS event_requests
        FROM events
        WHERE site_id = {siteId:Int32}
          ${filterStatement}
          ${timeStatement}
      ),
      category_stats AS (
        SELECT
          count() AS category_all,
          countIf(${getBotPurposeExpression()} = 'ai_answers') AS category_ai_answers,
          countIf(${getBotPurposeExpression()} = 'indexing') AS category_indexing,
          countIf(${getBotPurposeExpression()} = 'training') AS category_training
        FROM bot_events
        WHERE site_id = {siteId:Int32}
          ${filterStatement}
          ${timeStatement}
      )
    SELECT
      bot_requests,
      all_bot_requests + event_requests AS total_events,
      if(
        all_bot_requests + event_requests = 0,
        0,
        round(bot_requests * 100.0 / (all_bot_requests + event_requests), 2)
      ) AS bot_percentage,
      ua_pattern,
      header_heuristics,
      client_signals,
      bot_asn,
      rate_anomaly,
      category_all,
      category_ai_answers,
      category_indexing,
      category_training
    FROM bot_stats
    CROSS JOIN all_bot_stats
    CROSS JOIN event_stats
    CROSS JOIN category_stats
  `;
};

export async function getBotOverview(req: FastifyRequest<BotOverviewRequest>, res: FastifyReply) {
  try {
    const result = await clickhouse.query({
      query: getQuery(req.query),
      format: "JSONEachRow",
      query_params: {
        siteId: Number(req.params.siteId),
      },
    });

    const data = await processResults<BotOverviewResponse>(result);
    return res.send({ data: data[0] });
  } catch (error) {
    console.error("Error fetching bot overview:", error);
    return res.status(500).send({ error: "Failed to fetch bot overview" });
  }
}
