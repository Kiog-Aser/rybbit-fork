import { FastifyReply, FastifyRequest } from "fastify";
import { DateTime } from "luxon";
import { z } from "zod";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { lookupAsn } from "../../db/geolocation/asn.js";
import { getLocation } from "../../db/geolocation/geolocation.js";
import { siteConfig } from "../../lib/siteConfig.js";
import { createServiceLogger } from "../../lib/logger/logger.js";
import { getDeviceType } from "../../utils.js";
import { parseUserAgent } from "./utils.js";
import { classifyBotAsn } from "./botBlocking/botProviderAsns.js";
import { classifyUA } from "./botBlocking/uaBots/index.js";
import { resolveClientIp } from "./resolveClientIp.js";

const logger = createServiceLogger("ai-crawl-ingest");

const PURPOSE_CATEGORY = z.enum(["answer_fetch", "search_index", "training", "ai_crawler"]);

const aiCrawlBodySchema = z.object({
  // Accept both Rybbit (siteId) and DataFast-compatible (websiteId) keys.
  siteId: z.string().min(1).max(64).optional(),
  websiteId: z.string().min(1).max(64).optional(),
  domain: z.string().max(253).optional(),
  href: z.string().url().max(8192),
  referrer: z.string().max(2048).nullable().optional(),
  ai: z.object({
    provider: z.string().max(100).optional(),
    agent: z.string().max(200).optional(),
    category: PURPOSE_CATEGORY.optional(),
    userAgent: z.string().max(512).optional(),
    ip: z.string().max(64).nullable().optional(),
    statusCode: z.number().int().min(0).max(599).optional(),
    source: z.string().max(64).optional(),
  }),
});

/**
 * Map middleware categories → values the bots dashboard purpose expression understands.
 * Store agent as matched_ua_pattern so existing multiIf rules (chatgpt-user, gptbot, …) work.
 */
function mapPurposeToBotCategory(category: string | undefined): "ai" | "search" {
  if (category === "search_index") return "search";
  return "ai";
}

function normalizeMatchedPattern(
  agent: string | undefined,
  userAgent: string,
  category: string
): string {
  const fromClient = (agent || "").trim().toLowerCase();
  if (fromClient) {
    // Prefix with purpose category so dashboard bucketing is reliable even for
    // generic agent names (e.g. "openai" from alias fallback).
    return `${category}:${fromClient}`;
  }

  const classification = classifyUA(userAgent);
  if (classification.matchedPattern) {
    return `${category}:${classification.matchedPattern}`;
  }

  return `${category}:unknown-ai-crawler`;
}

function parseHref(href: string): { hostname: string; pathname: string; querystring: string } | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return {
      hostname: url.hostname.toLowerCase().replace(/:\d+$/, ""),
      pathname: url.pathname || "/",
      querystring: url.search || "",
    };
  } catch {
    return null;
  }
}

/**
 * Public ingest for site-side AI crawler middleware.
 * POST /api/ai-crawls
 */
export async function handleAiCrawlIngest(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = aiCrawlBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const siteIdentifier = (body.siteId || body.websiteId || "").trim();
    if (!siteIdentifier) {
      return reply.status(400).send({ success: false, error: "siteId is required" });
    }

    const configuration = await siteConfig.getConfig(siteIdentifier);
    if (!configuration) {
      return reply.status(404).send({ success: false, error: "Site not found" });
    }

    const pathInfo = parseHref(body.href);
    if (!pathInfo) {
      return reply.status(400).send({ success: false, error: "Invalid href" });
    }

    const userAgent =
      body.ai.userAgent ||
      (typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : "") ||
      "";

    // Prefer crawler IP from middleware (origin edge). Fall back to caller IP.
    const crawlerIp = (body.ai.ip || "").trim() || resolveClientIp(request);
    const category = body.ai.category || "ai_crawler";
    const matchedPattern = normalizeMatchedPattern(body.ai.agent, userAgent, category);
    const botCategory = mapPurposeToBotCategory(category);

    // Server-side re-check: only store if UA looks like a bot OR client sent a known agent.
    const uaClassification = classifyUA(userAgent);
    if (!uaClassification.isBot && !body.ai.agent) {
      return reply.status(200).send({ success: true, tracked: false, reason: "not_ai_crawler" });
    }

    const asnInfo = crawlerIp ? lookupAsn(crawlerIp) : null;
    const asnMatch = classifyBotAsn(asnInfo?.asn);
    const location = crawlerIp ? (await getLocation([crawlerIp]))?.[crawlerIp] : undefined;
    const ua = parseUserAgent(userAgent);
    const hostname = body.domain?.toLowerCase().replace(/:\d+$/, "") || pathInfo.hostname;
    const referrer = body.referrer || "";

    await clickhouse.insert({
      table: "bot_events",
      values: [
        {
          site_id: configuration.siteId,
          timestamp: DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss"),
          session_id: `crawler:${matchedPattern}:${crawlerIp || "unknown"}`,
          user_id: `crawler:${userAgent.slice(0, 120) || matchedPattern}`,
          hostname,
          pathname: pathInfo.pathname,
          querystring: pathInfo.querystring,
          referrer,
          browser: ua.browser.name || body.ai.provider || "",
          browser_version: ua.browser.major || "",
          operating_system: ua.os.name || "",
          operating_system_version: ua.os.version || "",
          country: location?.countryIso || "",
          region: location?.countryIso && location?.region ? `${location.countryIso}-${location.region}` : "",
          city: location?.city || "",
          lat: location?.latitude || 0,
          lon: location?.longitude || 0,
          screen_width: 0,
          screen_height: 0,
          device_type: getDeviceType(0, 0, ua),
          type: "crawler_request",
          asn: asnInfo?.asn ?? null,
          asn_org: asnInfo?.organization || "",
          detected_ua_pattern: true,
          detected_header_heuristics: false,
          detected_client_signals: false,
          detected_bot_asn: asnMatch.isBotInfrastructure,
          detected_rate_anomaly: false,
          matched_ua_pattern: matchedPattern,
          bot_category: botCategory,
        },
      ],
      format: "JSONEachRow",
    });

    return reply.status(200).send({
      success: true,
      tracked: true,
      category,
      agent: matchedPattern,
    });
  } catch (error) {
    logger.error(error, "Failed to ingest AI crawler event");
    return reply.status(500).send({ success: false, error: "Failed to track crawler" });
  }
}
