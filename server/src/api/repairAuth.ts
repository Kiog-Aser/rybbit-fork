import { FastifyRequest, FastifyReply } from "fastify";
import { AKASH_LEAN_MODE } from "../lib/const.js";
import { ensureBootstrapAdmin } from "../lib/bootstrapAdmin.js";
import { getAuthReadiness } from "./getConfig.js";

export async function repairAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!AKASH_LEAN_MODE) {
    return reply.status(404).send({ error: "Not available" });
  }

  const repairToken = process.env.BETTER_AUTH_SECRET;
  const provided = request.headers["x-repair-token"];
  if (!repairToken || provided !== repairToken) {
    return reply.status(403).send({ error: "Forbidden" });
  }

  try {
    await ensureBootstrapAdmin();
    const auth = await getAuthReadiness();
    let postgresReady = false;
    try {
      const { db } = await import("../db/postgres/postgres.js");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      postgresReady = true;
    } catch {
      postgresReady = false;
    }

    return reply.send({
      ok: auth.passwordVerified && postgresReady,
      postgresReady,
      ...auth,
      loginReady: postgresReady && auth.tablesReady && auth.bootstrapUserReady && auth.passwordVerified,
    });
  } catch (error) {
    request.log.error(error, "repair-auth failed");
    return reply.status(500).send({
      ok: false,
      error: error instanceof Error ? error.message : "repair-auth failed",
    });
  }
}