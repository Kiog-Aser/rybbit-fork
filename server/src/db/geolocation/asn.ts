import type { Asn } from "@maxmind/geoip2-node";
import { Reader } from "@maxmind/geoip2-node";
import { readFile } from "fs/promises";
import path from "path";
import { DISABLE_GEOLITE } from "../../lib/const.js";
import { logger } from "../../lib/logger/logger.js";

const dbPath = path.join(process.cwd(), "GeoLite2-ASN.mmdb");

interface AsnReader extends Reader {
  asn(ip: string): Asn;
}

let reader: AsnReader | null = null;
let loadPromise: Promise<void> | null = null;

function startLoad(): Promise<void> {
  if (DISABLE_GEOLITE) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const buf = await readFile(dbPath);
      reader = Reader.openBuffer(buf) as AsnReader;
      logger.info("GeoIP ASN database loaded successfully");
    } catch (err) {
      logger.warn({ err, dbPath }, "GeoIP ASN database not loaded — ASN-based bot detection disabled");
      reader = null;
    }
  })();

  return loadPromise;
}

export interface AsnInfo {
  asn: number;
  organization: string;
}

export function lookupAsn(ip: string): AsnInfo | null {
  if (DISABLE_GEOLITE || !ip) return null;
  if (!reader) return null;
  try {
    const res = reader.asn(ip);
    if (typeof res.autonomousSystemNumber !== "number") return null;
    return {
      asn: res.autonomousSystemNumber,
      organization: res.autonomousSystemOrganization ?? "",
    };
  } catch {
    return null;
  }
}