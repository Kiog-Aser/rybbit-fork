import { BetterAuthError } from "@better-auth/core/error";
import {
  constantTimeEqual,
  hashPassword as defaultHashPassword,
  verifyPassword as defaultVerifyPassword,
} from "better-auth/crypto";
import { hex } from "@better-auth/utils/hex";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { hexToBytes } from "@noble/hashes/utils.js";

/** Better Auth stores passwords as hexSalt:hexKey */
const BETTER_AUTH_HASH_RE = /^[0-9a-f]+:[0-9a-f]+$/i;

export function isBetterAuthPasswordHash(hash: string | null | undefined): hash is string {
  return typeof hash === "string" && BETTER_AUTH_HASH_RE.test(hash);
}

type ScryptConfig = {
  N: number;
  r: number;
  p: number;
  dkLen: number;
};

const leanScryptConfig: ScryptConfig = {
  N: 8192,
  r: 8,
  p: 1,
  dkLen: 64,
};

async function scryptKey(password: string, salt: string, config: ScryptConfig) {
  return scryptAsync(password.normalize("NFKC"), salt, {
    N: config.N,
    p: config.p,
    r: config.r,
    dkLen: config.dkLen,
    maxmem: 128 * config.N * config.r * 2,
  });
}

function createPasswordFns(config: ScryptConfig) {
  return {
    hash: async (password: string) => {
      const salt = hex.encode(crypto.getRandomValues(new Uint8Array(16)));
      const key = await scryptKey(password, salt, config);
      return `${salt}:${hex.encode(key)}`;
    },
    verify: async ({ hash, password }: { hash: string; password: string }) => {
      if (!isBetterAuthPasswordHash(hash)) {
        return false;
      }
      const [salt, keyHex] = hash.split(":");
      try {
        const derived = await scryptKey(password, salt, config);
        return constantTimeEqual(derived, hexToBytes(keyHex));
      } catch {
        return false;
      }
    },
  };
}

export const leanPassword = createPasswordFns(leanScryptConfig);

export const defaultPassword = {
  hash: defaultHashPassword,
  verify: async (input: { hash: string; password: string }) => {
    if (!isBetterAuthPasswordHash(input.hash)) {
      return false;
    }
    try {
      return await defaultVerifyPassword(input);
    } catch (error) {
      if (error instanceof BetterAuthError) {
        return false;
      }
      throw error;
    }
  },
};

export async function passwordMatchesEnv(
  storedHash: string | null | undefined,
  password: string,
  useLean: boolean
): Promise<boolean> {
  if (!storedHash || !password) {
    return false;
  }
  const fns = useLean ? leanPassword : defaultPassword;
  return fns.verify({ hash: storedHash, password });
}