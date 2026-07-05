import { sql } from "drizzle-orm";
import { FastifyRequest, FastifyReply } from "fastify";
import { createRequire } from "module";
import { db } from "../db/postgres/postgres.js";
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

export async function getConfig(_: FastifyRequest, reply: FastifyReply) {
  let postgresReady = false;
  try {
    await db.execute(sql`SELECT 1`);
    postgresReady = true;
  } catch {
    postgresReady = false;
  }

  return reply.send({
    disableSignup: DISABLE_SIGNUP,
    singleUserMode: BOOTSTRAP_ADMIN_MODE,
    bootstrapAdminEmail: BOOTSTRAP_ADMIN_MODE ? BOOTSTRAP_ADMIN_EMAIL : null,
    mapboxToken: MAPBOX_TOKEN,
    liteDashboard: LITE_DASHBOARD,
    revenueAttribution: REVENUE_ATTRIBUTION,
    postgresReady,
  });
}

export async function getVersion(_: FastifyRequest, reply: FastifyReply) {
  return reply.send({ version });
}
