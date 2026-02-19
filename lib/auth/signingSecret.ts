import { readEnv, requiredEnv } from "@/lib/env";

const DEV_SECRET = "datagems-dev-session-secret";
const DEV_LIKE_ENVS = new Set(["development", "test"]);

let warned = false;

function isDevLikeRuntime() {
  return DEV_LIKE_ENVS.has(process.env.NODE_ENV ?? "");
}

function warnFallback() {
  if (warned) return;
  warned = true;
  console.warn(
    `[DataGems] DATAGEN_SESSION_SECRET is missing; using an insecure default for ${process.env.NODE_ENV ?? "unknown"} only.`,
  );
}

export function getSigningSecret() {
  const configured = readEnv("DATAGEN_SESSION_SECRET");
  if (configured) return configured;
  if (isDevLikeRuntime()) {
    warnFallback();
    return DEV_SECRET;
  }
  return requiredEnv("DATAGEN_SESSION_SECRET");
}
