import { CStoreAuth } from "@ratio1/cstore-auth-ts";

import { requiredEnv } from "@/lib/env";
import { getCStore } from "./client";
import { mockAuth } from "./mock";
import { REQUIRED_AUTH_ENV_KEYS, shouldUseMockCStore } from "./mockMode";

let authInstance: CStoreAuth | null = null;
let initPromise: Promise<void> | null = null;

function ensureAuthEnv() {
  for (const key of REQUIRED_AUTH_ENV_KEYS) {
    requiredEnv(key);
  }
}

function cstoreAuthAdapter() {
  const cstore = getCStore();
  return {
    hget: (hkey: string, key: string) => cstore.hget({ hkey, key }),
    hset: async (hkey: string, key: string, value: string) => {
      await cstore.hset({ hkey, key, value });
    },
    hgetAll: (hkey: string) => cstore.hgetall({ hkey }),
  };
}

export function getAuthClient() {
  if (shouldUseMockCStore()) {
    return mockAuth as unknown as CStoreAuth;
  }
  if (!authInstance) {
    ensureAuthEnv();
    authInstance = new CStoreAuth({
      // Adapt edge-sdk cstore client to the interface expected by cstore-auth-ts
      client: cstoreAuthAdapter(),
    });
  }
  return authInstance;
}

export async function ensureAuthInitialized() {
  if (!initPromise) {
    initPromise = getAuthClient().simple.init();
  }
  await initPromise;
  return getAuthClient();
}
