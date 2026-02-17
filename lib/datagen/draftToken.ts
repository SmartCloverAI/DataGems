import { sign, verify } from "jsonwebtoken";

import { requiredEnv } from "@/lib/env";

const DRAFT_TTL_SECONDS = 60 * 30; // 30 minutes

export type DraftTokenPayload = {
  title: string;
  totalRecords: number;
  description: string;
  instructions: string;
  schema: unknown;
  schemaGeneratedAt: string;
  schemaDurationMs: number;
  schemaRefreshes: number;
  datasetMode?: boolean;
  profileId?: string;
  inferenceBaseUrl?: string;
  inferencePath?: string;
  inferenceModel?: string;
  inferenceParams?: Record<string, unknown>;
};

function draftSecret() {
  return requiredEnv("DATAGEN_SESSION_SECRET");
}

export function createDraftToken(payload: DraftTokenPayload) {
  return sign(payload, draftSecret(), { expiresIn: DRAFT_TTL_SECONDS });
}

export function parseDraftToken(token: string | undefined | null) {
  if (!token) return null;
  try {
    return verify(token, draftSecret()) as DraftTokenPayload;
  } catch {
    return null;
  }
}
