import { DateTime } from "luxon";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";

export interface RybbitTimeseriesRow {
  time: string;
  sessions: number;
  pages_per_session: number;
  bounce_rate: number;
  session_duration: number;
  pageviews: number;
  users: number;
}

function escapeClickHouseString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeRowTime(time: string): string | null {
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

  return null;
}

function buildSessionHourlySelect(siteId: number, importId: string, row: RybbitTimeseriesRow): string {
  const time = escapeClickHouseString(row.time);
  const sessions = Math.max(0, Math.floor(row.sessions));
  const pageviews = Math.max(0, Math.floor(row.pageviews));
  const users = Math.max(0, Math.floor(row.users));
  const bounced = Math.round((sessions * row.bounce_rate) / 100);
  const duration = Math.round(sessions * row.session_duration);

  return `
    SELECT
      ${siteId} AS site_id,
      toUUID('${importId}') AS import_id,
      toDateTime('${time}') AS session_hour,
      ${sessions} AS sessions,
      ${pageviews} AS pageviews,
      (
        SELECT uniqStateIf(
          concat('ry:', '${importId}', ':u:', formatDateTime(toDateTime('${time}'), '%Y%m%d%H'), ':', toString(number)),
          number < ${users}
        )
        FROM numbers(greatest(${users}, 1))
      ) AS users,
      ${duration} AS total_session_duration_seconds,
      ${bounced} AS bounced_sessions
  `;
}

function buildOverviewHourlySelect(siteId: number, importId: string, row: RybbitTimeseriesRow): string {
  const time = escapeClickHouseString(row.time);
  const sessions = Math.max(0, Math.floor(row.sessions));
  const pageviews = Math.max(0, Math.floor(row.pageviews));
  const users = Math.max(0, Math.floor(row.users));

  return `
    SELECT
      ${siteId} AS site_id,
      toUUID('${importId}') AS import_id,
      toDateTime('${time}') AS event_hour,
      ${pageviews} AS pageviews,
      ${pageviews} AS events,
      (
        SELECT uniqStateIf(
          concat('ry:', '${importId}', ':u:', formatDateTime(toDateTime('${time}'), '%Y%m%d%H'), ':', toString(number)),
          number < ${users}
        )
        FROM numbers(greatest(${users}, 1))
      ) AS users,
      (
        SELECT uniqStateIf(
          concat('ry:', '${importId}', ':s:', formatDateTime(toDateTime('${time}'), '%Y%m%d%H'), ':', toString(number)),
          number < ${sessions}
        )
        FROM numbers(greatest(${sessions}, 1))
      ) AS sessions
  `;
}

function buildBackfillTrackingSelect(siteId: number, importId: string, row: RybbitTimeseriesRow): string {
  const time = escapeClickHouseString(row.time);
  return `
    SELECT
      ${siteId} AS site_id,
      toUUID('${importId}') AS import_id,
      toDateTime('${time}') AS session_hour
  `;
}

export async function instantImportRybbitExport(args: {
  siteId: number;
  importId: string;
  rows: RybbitTimeseriesRow[];
}): Promise<{ importedDays: number; skippedDays: number; importedPageviews: number }> {
  const { siteId, importId, rows } = args;

  const activeRows = rows.flatMap(row => {
    const normalizedTime = normalizeRowTime(row.time);
    if (!normalizedTime) return [];

    const sessions = Math.max(0, Math.floor(row.sessions));
    const pageviews = Math.max(0, Math.floor(row.pageviews));
    const users = Math.max(0, Math.floor(row.users));
    if (sessions === 0 && pageviews === 0 && users === 0) return [];

    return [{ ...row, time: normalizedTime }];
  });

  if (activeRows.length === 0) {
    return { importedDays: 0, skippedDays: rows.length, importedPageviews: 0 };
  }

  const sessionSelects = activeRows.map(row => buildSessionHourlySelect(siteId, importId, row)).join("\nUNION ALL\n");
  const overviewSelects = activeRows.map(row => buildOverviewHourlySelect(siteId, importId, row)).join("\nUNION ALL\n");
  const trackingSelects = activeRows.map(row => buildBackfillTrackingSelect(siteId, importId, row)).join("\nUNION ALL\n");

  await clickhouse.exec({
    query: `INSERT INTO session_hourly_import_target\n${sessionSelects}`,
  });

  await clickhouse.exec({
    query: `INSERT INTO overview_hourly_import_target\n${overviewSelects}`,
  });

  await clickhouse.exec({
    query: `INSERT INTO import_mv_backfill\n${trackingSelects}`,
  });

  const importedPageviews = activeRows.reduce((sum, row) => sum + Math.max(0, Math.floor(row.pageviews)), 0);

  return {
    importedDays: activeRows.length,
    skippedDays: rows.length - activeRows.length,
    importedPageviews,
  };
}

export function filterRowsByAllowedDateRange(
  rows: RybbitTimeseriesRow[],
  earliestAllowedDate: string,
  latestAllowedDate: string
): { allowed: RybbitTimeseriesRow[]; skipped: number } {
  const earliest = DateTime.fromISO(earliestAllowedDate, { zone: "utc" }).startOf("day");
  const latest = DateTime.fromISO(latestAllowedDate, { zone: "utc" }).endOf("day");

  let skipped = 0;
  const allowed: RybbitTimeseriesRow[] = [];

  for (const row of rows) {
    const normalizedTime = normalizeRowTime(row.time);
    if (!normalizedTime) {
      skipped++;
      continue;
    }
    const dt = DateTime.fromFormat(normalizedTime, "yyyy-MM-dd HH:mm:ss", { zone: "utc" });
    if (!dt.isValid || dt < earliest || dt > latest) {
      skipped++;
      continue;
    }
    allowed.push({ ...row, time: normalizedTime });
  }

  return { allowed, skipped };
}

export async function deleteRybbitExportMvData(siteId: number, importId: string): Promise<void> {
  await clickhouse.command({
    query: `
      ALTER TABLE session_hourly_import_target
      DELETE WHERE site_id = {siteId:UInt16}
        AND import_id = {importId:UUID}
    `,
    query_params: { siteId, importId },
  });

  await clickhouse.command({
    query: `
      ALTER TABLE overview_hourly_import_target
      DELETE WHERE site_id = {siteId:UInt16}
        AND import_id = {importId:UUID}
    `,
    query_params: { siteId, importId },
  });

  await clickhouse.command({
    query: `
      ALTER TABLE import_mv_backfill
      DELETE WHERE site_id = {siteId:UInt16}
        AND import_id = {importId:UUID}
    `,
    query_params: { siteId, importId },
  });
}