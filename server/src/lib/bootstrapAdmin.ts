import { generateId } from "@better-auth/core/utils/id";
import { eq } from "drizzle-orm";
import { db } from "../db/postgres/postgres.js";
import { member, organization, user } from "../db/postgres/schema.js";
import { AKASH_LEAN_MODE } from "./const.js";
import { auth } from "./auth.js";
import { createServiceLogger } from "./logger/logger.js";
import { isBetterAuthPasswordHash, passwordMatchesEnv } from "./passwordHash.js";

const logger = createServiceLogger("bootstrap-admin");

export function getBootstrapAdminEmail(): string | null {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function isBootstrapAdminMode(): boolean {
  const email = getBootstrapAdminEmail();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  return Boolean(email && password);
}

async function ensureBootstrapOrganization(userId: string, orgName: string): Promise<void> {
  const existingMembership = await db.select({ id: member.id }).from(member).where(eq(member.userId, userId)).limit(1);
  if (existingMembership.length > 0) {
    return;
  }

  const now = new Date().toISOString();
  const orgId = generateId();
  const slugBase = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";

  await db.insert(organization).values({
    id: orgId,
    name: orgName,
    slug: `${slugBase}-${orgId.slice(0, 6)}`,
    createdAt: now,
  });

  await db.insert(member).values({
    id: generateId(),
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: now,
  });

  logger.info({ userId, organizationId: orgId }, "Created bootstrap organization");
}

export async function ensureBootstrapAdmin(): Promise<void> {
  const email = getBootstrapAdminEmail();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Admin";

  if (!email || !password) {
    return;
  }

  if (password.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters");
  }

  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  const hashedPassword = await ctx.password.hash(password);

  if (!existing?.user) {
    const createdUser = await ctx.internalAdapter.createUser({
      email,
      name,
      emailVerified: true,
    });

    if (!createdUser) {
      throw new Error("Failed to create bootstrap admin user");
    }

    await ctx.internalAdapter.linkAccount({
      accountId: createdUser.id,
      providerId: "credential",
      password: hashedPassword,
      userId: createdUser.id,
    });

    await db.update(user).set({ role: "admin" }).where(eq(user.id, createdUser.id));
    await ensureBootstrapOrganization(createdUser.id, `${name}'s Organization`);
    logger.info({ email }, "Created bootstrap admin account");
    return;
  }

  await db.update(user).set({ role: "admin" }).where(eq(user.id, existing.user.id));

  const credentialAccount = existing.accounts?.find(account => account.providerId === "credential");
  if (!credentialAccount) {
    await ctx.internalAdapter.linkAccount({
      accountId: existing.user.id,
      providerId: "credential",
      password: hashedPassword,
      userId: existing.user.id,
    });
  } else {
    const storedHash = credentialAccount.password;
    const hashLooksValid = isBetterAuthPasswordHash(storedHash);
    const passwordMatches =
      hashLooksValid && (await passwordMatchesEnv(storedHash, password, AKASH_LEAN_MODE));

    // Re-hash when env password changed, hash format is invalid, or verify would throw in Better Auth.
    if (!passwordMatches) {
      await ctx.internalAdapter.updatePassword(existing.user.id, hashedPassword);
      logger.info({ email, hashLooksValid }, "Refreshed bootstrap admin credential password");
    }
  }

  await ensureBootstrapOrganization(existing.user.id, `${name}'s Organization`);
  logger.info({ email }, "Bootstrap admin account ready");
}