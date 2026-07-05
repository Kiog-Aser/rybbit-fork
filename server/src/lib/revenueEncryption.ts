import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { SECRET } from "./const.js";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const source = process.env.REVENUE_ENCRYPTION_KEY || SECRET;
  if (!source) {
    throw new Error("REVENUE_ENCRYPTION_KEY or BETTER_AUTH_SECRET is required for Stripe key storage");
  }
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted secret format");
  }
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}