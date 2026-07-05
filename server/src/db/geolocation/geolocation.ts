import type { City } from "@maxmind/geoip2-node";
import { Reader } from "@maxmind/geoip2-node";
import { readFile } from "fs/promises";
import path from "path";
import { AKASH_LEAN_MODE } from "../../lib/const.js";
import { logger } from "../../lib/logger/logger.js";
import { LocationResponse } from "./types.js";

const dbPath = path.join(process.cwd(), "GeoLite2-City.mmdb");

interface ExtendedReader extends Reader {
  city(ip: string): City;
}

let reader: ExtendedReader | null = null;
let loadPromise: Promise<void> | null = null;

function startLoad(): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const dbBuffer = await readFile(dbPath);
      reader = Reader.openBuffer(dbBuffer) as ExtendedReader;
      logger.info("GeoIP database loaded successfully");
    } catch (err) {
      logger.warn({ err, dbPath }, "GeoIP City database not loaded — geolocation disabled");
      reader = null;
    }
  })();

  return loadPromise;
}

// Lean Akash deployments skip the 63MB City DB to avoid OOM during startup.
if (!AKASH_LEAN_MODE) {
  void startLoad();
}

function extractLocationData(response: City | null): LocationResponse {
  if (!response) {
    return null;
  }

  return {
    city: response.city?.names?.en,
    country: response.country?.names?.en,
    countryIso: response.country?.isoCode,
    latitude: response.location?.latitude,
    longitude: response.location?.longitude,
    timeZone: response.location?.timeZone,
    region: response.subdivisions?.[0]?.isoCode,
  };
}

export async function getLocation(ips: string[]): Promise<Record<string, LocationResponse>> {
  await startLoad();

  const results: Record<string, LocationResponse> = {};
  for (const ip of new Set(ips)) {
    if (!reader) {
      results[ip] = null;
      continue;
    }
    try {
      results[ip] = extractLocationData(reader.city(ip));
    } catch {
      results[ip] = null;
    }
  }
  return results;
}