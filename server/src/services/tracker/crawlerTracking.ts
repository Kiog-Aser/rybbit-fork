import type { FastifyRequest } from "fastify";
import { DateTime } from "luxon";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { lookupAsn } from "../../db/geolocation/asn.js";
import { getLocation } from "../../db/geolocation/geolocation.js";
import { siteConfig } from "../../lib/siteConfig.js";
import { getDeviceType } from "../../utils.js";
import { parseUserAgent } from "./utils.js";
import { classifyBotAsn } from "./botBlocking/botProviderAsns.js";
import { classifyUA } from "./botBlocking/uaBots/index.js";

const DOCUMENT_EXTENSIONS = /\.(?:css|js|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|pdf|zip|xml|json)$/i;
const DISCOVERY_PATHS = new Set(["/robots.txt", "/llms.txt", "/llms-full.txt", "/sitemap.xml"]);

function isDocumentRequest(request: FastifyRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const path = request.url.split("?", 1)[0];
  if (path.startsWith("/api/") || path.startsWith("/_next/") || path === "/script.js") return false;
  if (DISCOVERY_PATHS.has(path)) return true;
  return !DOCUMENT_EXTENSIONS.test(path);
}

export async function recordCrawlerRequest(request: FastifyRequest): Promise<void> {
  if (!isDocumentRequest(request)) return;

  const userAgent = typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : "";
  const classification = classifyUA(userAgent);
  if (!classification.isBot || !["ai", "search"].includes(classification.category || "")) return;

  const hostname = request.hostname.toLowerCase().replace(/:\d+$/, "");
  const configuration = await siteConfig.getConfigByDomain(hostname);
  if (!configuration) return;

  const ipAddress = request.ip || "";
  const asnInfo = ipAddress ? lookupAsn(ipAddress) : null;
  const asnMatch = classifyBotAsn(asnInfo?.asn);
  const location = ipAddress ? (await getLocation([ipAddress]))?.[ipAddress] : undefined;
  const ua = parseUserAgent(userAgent);
  const path = request.url.split("?", 1)[0];
  const querystring = request.url.includes("?") ? `?${request.url.split("?")[1]}` : "";

  await clickhouse.insert({
    table: "bot_events",
    values: [
      {
        site_id: configuration.siteId,
        timestamp: DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss"),
        session_id: `crawler:${classification.matchedPattern || "unknown"}:${ipAddress}`,
        user_id: `crawler:${userAgent.slice(0, 120)}`,
        hostname,
        pathname: path,
        querystring,
        referrer: typeof request.headers.referer === "string" ? request.headers.referer : "",
        browser: ua.browser.name || "",
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
        matched_ua_pattern: classification.matchedPattern || "",
        bot_category: classification.category || "",
      },
    ],
    format: "JSONEachRow",
  });
}
