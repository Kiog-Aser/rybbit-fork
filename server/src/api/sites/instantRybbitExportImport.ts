import { FastifyReply, FastifyRequest } from "fastify";
import { DateTime } from "luxon";
import { z } from "zod";
import { db } from "../../db/postgres/postgres.js";
import { organization, sites } from "../../db/postgres/schema.js";
import { eq } from "drizzle-orm";
import { getBestSubscription } from "../../lib/subscriptionUtils.js";
import { IS_CLOUD } from "../../lib/const.js";
import { importQuotaManager } from "../../services/import/importQuotaManager.js";
import {
  completeImport,
  getImportById,
  updateImportProgress,
} from "../../services/import/importStatusManager.js";
import {
  filterRowsByAllowedDateRange,
  instantImportRybbitExport,
} from "../../services/import/rybbitExportInstantImport.js";

const timeseriesRowSchema = z.object({
  time: z.string(),
  sessions: z.coerce.number().finite().nonnegative(),
  pages_per_session: z.coerce.number().finite().nonnegative(),
  bounce_rate: z.coerce.number().finite().nonnegative(),
  session_duration: z.coerce.number().finite().nonnegative(),
  pageviews: z.coerce.number().finite().nonnegative(),
  users: z.coerce.number().finite().nonnegative(),
});

const instantRybbitExportRequestSchema = z
  .object({
    params: z.object({
      siteId: z.coerce.number().int().positive(),
      importId: z.string().uuid(),
    }),
    body: z.object({
      timeseries: z.array(timeseriesRowSchema).min(1).max(5000),
    }),
  })
  .strict();

type InstantRybbitExportRequest = {
  Params: z.infer<typeof instantRybbitExportRequestSchema.shape.params>;
  Body: z.infer<typeof instantRybbitExportRequestSchema.shape.body>;
};

export async function instantRybbitExportImport(
  request: FastifyRequest<InstantRybbitExportRequest>,
  reply: FastifyReply
) {
  try {
    const parsed = instantRybbitExportRequestSchema.safeParse({
      params: request.params,
      body: request.body,
    });

    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error" });
    }

    const { siteId, importId } = parsed.data.params;
    const { timeseries } = parsed.data.body;

    const importRecord = await getImportById(importId);
    if (!importRecord) {
      return reply.status(404).send({ error: "Import not found" });
    }

    if (importRecord.siteId !== siteId) {
      return reply.status(400).send({ error: "Import does not belong to this site" });
    }

    if (importRecord.platform !== "rybbit_export") {
      return reply.status(400).send({ error: "Import is not a Rybbit export import" });
    }

    if (importRecord.completedAt !== null) {
      return reply.status(400).send({ error: "Import already completed" });
    }

    const [siteRecord] = await db
      .select({
        organizationId: sites.organizationId,
        stripeCustomerId: organization.stripeCustomerId,
      })
      .from(sites)
      .leftJoin(organization, eq(sites.organizationId, organization.id))
      .where(eq(sites.siteId, siteId))
      .limit(1);

    if (!siteRecord?.organizationId) {
      return reply.status(404).send({ error: "Site not found" });
    }

    if (IS_CLOUD) {
      const subscription = await getBestSubscription(siteRecord.organizationId, siteRecord.stripeCustomerId);
      if (subscription.source === "free") {
        return reply.status(403).send({
          error: "Data import is not available on the free plan. Please upgrade to a paid plan.",
        });
      }
    }

    try {
      const quotaTracker = await importQuotaManager.getTracker(siteRecord.organizationId);
      const oldestAllowedMonth = quotaTracker.getOldestAllowedMonth();
      const earliestAllowedDate = DateTime.fromFormat(oldestAllowedMonth + "01", "yyyyMMdd", {
        zone: "utc",
      }).toFormat("yyyy-MM-dd");
      const latestAllowedDate = DateTime.utc().toFormat("yyyy-MM-dd");

      const { allowed, skipped: skippedByDate } = filterRowsByAllowedDateRange(
        timeseries,
        earliestAllowedDate,
        latestAllowedDate
      );

      const result = await instantImportRybbitExport({
        siteId,
        importId,
        rows: allowed,
      });

      await updateImportProgress(importId, result.importedPageviews, skippedByDate + result.skippedDays, 0);
      await completeImport(importId);
      importQuotaManager.completeImport(siteRecord.organizationId);

      return reply.send({
        data: {
          importedDays: result.importedDays,
          skippedDays: skippedByDate + result.skippedDays,
          importedPageviews: result.importedPageviews,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Instant Rybbit export import failed:", message);
      await completeImport(importId);
      importQuotaManager.completeImport(siteRecord.organizationId);
      return reply.status(500).send({ error: `Failed to import Rybbit export: ${message}` });
    }
  } catch (error) {
    console.error("Error in instant Rybbit export import:", error);
    return reply.status(500).send({ error: "Internal server error" });
  }
}