import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthFromRequest } from "@/lib/auth/requireAuth";
import { createDraftToken, parseDraftToken } from "@/lib/datagen/draftToken";
import { generateRecordSchema } from "@/lib/datagen/inference";
import { MAX_RECORDS_PER_JOB } from "@/lib/datagen/constants";
import { validateExternalBaseUrl } from "@/lib/security/urlValidation";
import {
  getActiveProfile,
  getProfileById,
  readUserSettings,
} from "@/lib/datagen/userSettings";

export const runtime = "nodejs";

const draftSchema = z.object({
  title: z.string().min(1).max(200),
  totalRecords: z.number().int().min(1).max(MAX_RECORDS_PER_JOB),
  description: z.string().min(1).max(2000),
  instructions: z.string().min(1).max(8000),
  datasetMode: z.boolean().optional(),
  useExternalApi: z.boolean().optional(),
  profileId: z.string().optional(),
  inferenceBaseUrl: z.string().url().optional(),
  inferencePath: z.string().max(200).optional(),
  inferenceModel: z.string().max(200).optional(),
  inferenceParams: z.record(z.string(), z.unknown()).optional(),
  previousDraftToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = (() => {
    try {
      return requireAuthFromRequest(request);
    } catch {
      return null;
    }
  })();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = draftSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const useExternalApi = parsed.data.useExternalApi === true;
  const settings = await readUserSettings(session.username);
  const profile = useExternalApi
    ? getProfileById(settings, parsed.data.profileId) ?? getActiveProfile(settings)
    : null;
  const baseUrl = useExternalApi
    ? parsed.data.inferenceBaseUrl ?? profile?.baseUrl
    : undefined;
  const path = useExternalApi
    ? parsed.data.inferencePath ?? profile?.path
    : undefined;
  const model = useExternalApi
    ? parsed.data.inferenceModel ?? profile?.model
    : undefined;
  if (useExternalApi && baseUrl) {
    const urlValidation = validateExternalBaseUrl(baseUrl);
    if (!urlValidation.ok) {
      return NextResponse.json(
        { error: urlValidation.error ?? "Inference base URL is not allowed" },
        { status: 400 },
      );
    }
  }

  const now = new Date().toISOString();
  const start = Date.now();
  const { schema, failedAttempts } = await generateRecordSchema(
    parsed.data.instructions,
    parsed.data.datasetMode ?? false,
    {
      baseUrl,
      path,
      apiKey: useExternalApi ? profile?.apiKey : undefined,
      model,
      parameters: parsed.data.inferenceParams,
    },
  );
  const durationMs = Date.now() - start;
  const previous = parsed.data.previousDraftToken
    ? parseDraftToken(parsed.data.previousDraftToken)
    : null;
  const schemaRefreshes = previous ? previous.schemaRefreshes + 1 : 0;

  const draftToken = createDraftToken({
    title: parsed.data.title,
    totalRecords: parsed.data.totalRecords,
    description: parsed.data.description,
    instructions: parsed.data.instructions,
    schema,
    schemaGeneratedAt: now,
    schemaDurationMs: durationMs,
    schemaRefreshes,
    datasetMode: parsed.data.datasetMode ?? false,
    profileId: useExternalApi ? profile?.id : undefined,
    inferenceBaseUrl: baseUrl,
    inferencePath: path,
    inferenceModel: model,
    inferenceParams: parsed.data.inferenceParams,
  });

  return NextResponse.json({
    schema,
    schemaGeneratedAt: now,
    schemaDurationMs: durationMs,
    schemaRefreshes,
    draftToken,
    failedAttempts,
  });
}
