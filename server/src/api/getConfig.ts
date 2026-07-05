import { sql } from "drizzle-orm";
import { FastifyRequest, FastifyReply } from "fastify";
import { createRequire } from "module";
import { db } from "../db/postgres/postgres.js";
import { getBootstrapAdminEmail } from "../lib/bootstrapAdmin.js";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_MODE,
  DISABLE_SIGNUP,
  LITE_DASHBOARD,
  MAPBOX_TOKEN,
  REVENUE_ATTRIBUTION,
} from "../lib/const.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

type AuthReadiness = {
  tablesReady: boolean;
  bootstrapUserReady: boolean;
  error: string | null;
};

async function getAuthReadiness(): Promise<AuthReadiness> {
  const bootstrapEmail = getBootstrapAdminEmail();
  if (!bootstrapEmail) {
    return { tablesReady: true, bootstrapUserReady: true, error: null };
  }

  try {
    const [tables] = await db.execute<{
      has_user: boolean;
      has_account: boolean;
      has_session: boolean;
    }>(sql`
      SELECT
        to_regclass('public.user') IS NOT NULL AS has_user,
        to_regclass('public.account') IS NOT NULL AS has_account,
        to_regclass('public.session') IS NOT NULL AS has_session
    `);

    const tablesReady = Boolean(tables?.has_user && tables?.has_account && tables?.has_session);
    if (!tablesReady) {
      return {
        tablesReady: false,
        bootstrapUserReady: false,
        error: "Auth tables missing — Postgres migrations have not completed yet",
      };
    }

    const users = await db.execute<{ id: string }>(
      sql`SELECT id FROM "user" WHERE lower(email) = lower(${bootstrapEmail}) LIMIT 1`
    );
    const userId = users[0]?.id;
    if (!userId) {
      return {
        tablesReady: true,
        bootstrapUserReady: false,
        error: "Bootstrap admin user not created yet",
      };
    }

    const accounts = await db.execute<{ password: string | null }>(
      sql`SELECT password FROM account WHERE "userId" = ${userId} AND "providerId" = 'credential' LIMIT 1`
    );
    const password = accounts[0]?.password;
    const bootstrapUserReady = typeof password === "string" && password.includes(":");

    return {
      tablesReady: true,
      bootstrapUserReady,
      error: bootstrapUserReady
        ? null
        : "Bootstrap admin has no credential password — run bootstrap or redeploy backend",
    };
  } catch (error) {
    return {
      tablesReady: false,
      bootstrapUserReady: false,
      error: error instanceof Error ? error.message : "Auth readiness check failed",
    };
  }
}

export async function getConfig(_: FastifyRequest, reply: FastifyReply) {
  let postgresReady = false;
  try {
    await db.execute(sql`SELECT 1`);
    postgresReady = true;
  } catch {
    postgresReady = false;
  }

  const auth = await getAuthReadiness();

  return reply.send({
    disableSignup: DISABLE_SIGNUP,
    singleUserMode: BOOTSTRAP_ADMIN_MODE,
    bootstrapAdminEmail: BOOTSTRAP_ADMIN_MODE ? BOOTSTRAP_ADMIN_EMAIL : null,
    mapboxToken: MAPBOX_TOKEN,
    liteDashboard: LITE_DASHBOARD,
    revenueAttribution: REVENUE_ATTRIBUTION,
    postgresReady,
    authTablesReady: auth.tablesReady,
    bootstrapUserReady: auth.bootstrapUserReady,
    loginReady: postgresReady && auth.tablesReady && auth.bootstrapUserReady,
    authError: auth.error,
  });
}

export async function getVersion(_: FastifyRequest, reply: FastifyReply) {
  return reply.send({ version });
}