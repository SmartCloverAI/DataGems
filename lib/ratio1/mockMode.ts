import { envFlag, readEnv } from "@/lib/env";

const DEV_AUTO_MOCK_ENVS = new Set(["development", "test"]);

export const REQUIRED_AUTH_ENV_KEYS = [
  "R1EN_CSTORE_AUTH_HKEY",
  "R1EN_CSTORE_AUTH_SECRET",
  "R1EN_CSTORE_AUTH_BOOTSTRAP_ADMIN_PWD",
] as const;

let autoMockWarningShown = false;

function isDevLikeRuntime() {
  return DEV_AUTO_MOCK_ENVS.has(process.env.NODE_ENV ?? "");
}

function getCStoreEndpoint() {
  return (
    readEnv("EE_CHAINSTORE_API_URL") ??
    readEnv("EE_CHAINSTORE_API_HOST") ??
    readEnv("CSTORE_API_HOST")
  );
}

function getMissingAuthEnvKeys() {
  return REQUIRED_AUTH_ENV_KEYS.filter((key) => !readEnv(key));
}

function warnAutoMock(reasons: string[]) {
  if (autoMockWarningShown) return;
  autoMockWarningShown = true;
  console.warn(
    `[DataGems] Auto-enabling DATAGEN mock mode in ${process.env.NODE_ENV ?? "unknown"} because ${reasons.join("; ")}.`,
  );
}

export function shouldUseMockCStore() {
  if (envFlag("DATAGEN_MOCK_CSTORE")) return true;
  if (!isDevLikeRuntime()) return false;

  const reasons: string[] = [];
  const missingAuth = getMissingAuthEnvKeys();
  if (missingAuth.length > 0) {
    reasons.push(`auth env is missing (${missingAuth.join(", ")})`);
  }
  if (!getCStoreEndpoint()) {
    reasons.push("CStore endpoint env is missing");
  }
  if (reasons.length === 0) return false;

  warnAutoMock(reasons);
  return true;
}
