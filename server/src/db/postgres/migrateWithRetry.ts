import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import { db } from "./postgres.js";
import { createServiceLogger } from "../../lib/logger/logger.js";

const logger = createServiceLogger("postgres-migrate");
const execFileAsync = promisify(execFile);

const POSTGRES_WAIT_MS = parseInt(process.env.POSTGRES_WAIT_MS || "600000", 10);
const MIGRATE_RETRY_MS = parseInt(process.env.MIGRATE_RETRY_MS || "15000", 10);

async function isPostgresQueryable(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + POSTGRES_WAIT_MS;
  while (Date.now() < deadline) {
    if (await isPostgresQueryable()) {
      logger.info("PostgreSQL is reachable");
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`PostgreSQL not reachable after ${POSTGRES_WAIT_MS / 1000}s`);
}

async function runMigrationsOnce(): Promise<void> {
  await execFileAsync("npm", ["run", "db:migrate"], { cwd: process.cwd() });
}

export async function runMigrationsWithRetry(): Promise<void> {
  await waitForPostgres();

  const deadline = Date.now() + POSTGRES_WAIT_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      await runMigrationsOnce();
      logger.info({ attempt }, "Database migrations complete");
      return;
    } catch (error) {
      logger.warn({ err: error, attempt }, "Database migration attempt failed — retrying");
      await new Promise(resolve => setTimeout(resolve, MIGRATE_RETRY_MS));
    }
  }

  throw new Error("Database migrations failed after retries");
}

export async function ensureBootstrapAdminWithRetry(): Promise<void> {
  const { ensureBootstrapAdmin } = await import("../../lib/bootstrapAdmin.js");
  const deadline = Date.now() + POSTGRES_WAIT_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      await ensureBootstrapAdmin();
      logger.info({ attempt }, "Bootstrap admin ready");
      return;
    } catch (error) {
      logger.warn({ err: error, attempt }, "Bootstrap admin setup failed — retrying");
      await new Promise(resolve => setTimeout(resolve, MIGRATE_RETRY_MS));
    }
  }

  throw new Error("Bootstrap admin setup failed after retries");
}