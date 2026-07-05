import { eq } from "drizzle-orm";
import { db } from "../db/postgres/postgres.js";
import { user } from "../db/postgres/schema.js";
import { auth } from "./auth.js";
import { createServiceLogger } from "./logger/logger.js";

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
  const existing = await ctx.internalAdapter.findUserByEmail(email);
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
    // Always sync password from env so redeploys / SDL password changes take effect.
    // Stale or malformed hashes cause sign-in/email to 500 (scrypt verify throws).
    await ctx.internalAdapter.updatePassword(existing.user.id, hashedPassword);
  }

  logger.info({ email }, "Bootstrap admin account ready");
}