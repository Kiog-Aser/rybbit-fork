import { sql } from "drizzle-orm";
import { FastifyRequest, FastifyReply } from "fastify";
import { createRequire } from "module";
import { db } from "../db/postgres/postgres.js";
import { getBootstrapAdminEmail } from "../lib/bootstrapAdmin.js";
import {
  AKASH_LEAN_MODE,
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_MODE,
  DISABLE_SIGNUP,
  LITE_DASHBOARD,
  MAPBOX_TOKEN,
  REVENUE_ATTRIBUTION,
} from "../lib/const.js";
import { isBetterAuthPasswordHash, passwordMatchesEnv } from "../lib/passwordHash.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

type AuthReadiness = {
  tablesReady: boolean;
  bootstrapUserReady: boolean;
  passwordVerified: boolean;
  error: string | null;
};

async function getAuthReadiness(): Promise<AuthReadiness> {
  const bootstrapEmail = getBootstrapAdminEmail();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!bootstrapEmail) {
    return { tablesReady: true, bootstrapUserReady: true, passwordVerified: true, error: null };
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
        passwordVerified: false,
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
        passwordVerified: false,
        error: "Bootstrap admin user not created yet",
      };
    }

    const accounts = await db.execute<{ password: string | null }>(
      sql`SELECT password FROM account WHERE "userId" = ${userId} AND "providerId" = 'credential' LIMIT 1`
    );
    const password = accounts[0]?.password;
    const bootstrapUserReady = isBetterAuthPasswordHash(password);
    let passwordVerified = false;

    if (bootstrapUserReady && bootstrapPassword) {
      passwordVerified = await passwordMatchesEnv(password, bootstrapPassword, AKASH_LEAN_MODE);
    }

    return {
      tablesReady: true,
      bootstrapUserReady,
      passwordVerified,
      error: !bootstrapUserReady
        ? "Bootstrap admin has no valid credential password hash — redeploy backend to re-bootstrap"
        : !passwordVerified
          ? "Bootstrap password in DB does not match BOOTSTRAP_ADMIN_PASSWORD — redeploy backend"
          : null,
    };
  } catch (error) {
    return {
      tablesReady: false,
      bootstrapUserReady: false,
      passwordVerified: false,
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
    passwordVerified: auth.passwordVerified,
    loginReady: postgresReady && auth.tablesReady && auth.bootstrapUserReady && auth.passwordVerified,
    authError: auth.error,
  });
}

export async function getVersion(_: FastifyRequest, reply: FastifyReply) {
  return reply.send({ version });
}