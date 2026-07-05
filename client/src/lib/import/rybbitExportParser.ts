import JSZip from "jszip";
import Papa from "papaparse";
import { DateTime } from "luxon";
import { authedFetch } from "@/api/utils";

export interface RybbitTimeseriesRow {
  time: string;
  sessions: number;
  pages_per_session: number;
  bounce_rate: number;
  session_duration: number;
  pageviews: number;
  users: number;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRowTime(time: string): string {
  const trimmed = time.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const fromIso = DateTime.fromISO(trimmed, { zone: "utc" });
  if (fromIso.isValid) {
    return fromIso.toFormat("yyyy-MM-dd HH:mm:ss");
  }
  const fromSql = DateTime.fromSQL(trimmed, { zone: "utc" });
  if (fromSql.isValid) {
    return fromSql.toFormat("yyyy-MM-dd HH:mm:ss");
  }
  return "";
}

export async function parseRybbitExportZip(file: File): Promise<RybbitTimeseriesRow[]> {
  const zip = await JSZip.loadAsync(file);
  const timeseriesFile = zip.file("overview-timeseries.csv");

  if (!timeseriesFile) {
    throw new Error("Missing overview-timeseries.csv in Rybbit export zip");
  }

  const csv = await timeseriesFile.async("string");
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error("Failed to parse overview-timeseries.csv");
  }

  return parsed.data
    .map(row => ({
      time: normalizeRowTime(row.time ?? ""),
      sessions: parseNumber(row.sessions),
      pages_per_session: parseNumber(row.pages_per_session),
      bounce_rate: parseNumber(row.bounce_rate),
      session_duration: parseNumber(row.session_duration),
      pageviews: parseNumber(row.pageviews),
      users: parseNumber(row.users),
    }))
    .filter(row => row.time.length > 0);
}

export async function instantImportRybbitExport(
  siteId: number,
  importId: string,
  timeseries: RybbitTimeseriesRow[]
): Promise<{ importedDays: number; skippedDays: number; importedPageviews: number }> {
  const response = await authedFetch<{
    data: { importedDays: number; skippedDays: number; importedPageviews: number };
  }>(`/sites/${siteId}/imports/${importId}/rybbit-export`, undefined, {
    method: "POST",
    data: { timeseries },
  });

  return response.data;
}