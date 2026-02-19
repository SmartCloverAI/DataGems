import createEdgeSdk from "@ratio1/edge-sdk-ts";

import { envHostPortUrl, readEnv } from "@/lib/env";
import { mockCStore, mockR1fs } from "./mock";
import { shouldUseMockCStore } from "./mockMode";

type RatioClient = ReturnType<typeof createEdgeSdk>;

let cachedClient: RatioClient | null = null;

function buildCStoreUrl() {
  return (
    envHostPortUrl("EE_CHAINSTORE_API_HOST", "EE_CHAINSTORE_API_PORT") ||
    envHostPortUrl("CSTORE_API_HOST", "CSTORE_API_PORT") ||
    readEnv("EE_CHAINSTORE_API_URL")
  );
}

function buildR1fsUrl() {
  return (
    envHostPortUrl("EE_R1FS_API_HOST", "EE_R1FS_API_PORT") ||
    envHostPortUrl("R1FS_API_HOST", "R1FS_API_PORT") ||
    readEnv("EE_R1FS_API_URL")
  );
}

export function getRatioClient(): RatioClient {
  if (shouldUseMockCStore()) {
    // @ts-expect-error - mock implements the subset we need
    return { cstore: mockCStore, r1fs: mockR1fs } as RatioClient;
  }
  if (cachedClient) return cachedClient;
  const cstoreUrl = buildCStoreUrl();
  const r1fsUrl = buildR1fsUrl();
  cachedClient = createEdgeSdk({
    verbose: process.env.DATAGEN_DEBUG === "true",
    ...(cstoreUrl ? { cstoreUrl } : {}),
    ...(r1fsUrl ? { r1fsUrl } : {}),
  });
  return cachedClient;
}

export function resetRatioClient() {
  cachedClient = null;
}

export function getCStore() {
  return getRatioClient().cstore;
}

export function getR1fs() {
  return getRatioClient().r1fs;
}
