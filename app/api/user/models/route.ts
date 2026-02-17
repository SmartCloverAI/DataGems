import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthFromRequest } from "@/lib/auth/requireAuth";
import { validateExternalBaseUrl } from "@/lib/security/urlValidation";
import {
  getActiveProfile,
  getProfileById,
  readUserSettings,
} from "@/lib/datagen/userSettings";

export const runtime = "nodejs";

const bodySchema = z.object({
  profileId: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
});

function normalizeBase(base: string) {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

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
  const parsed = bodySchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const stored = await readUserSettings(session.username);
  const selectedProfile =
    getProfileById(stored, parsed.data.profileId) ?? getActiveProfile(stored);
  const baseUrl = parsed.data.baseUrl ?? selectedProfile?.baseUrl;
  const apiKey = parsed.data.apiKey ?? selectedProfile?.apiKey;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Inference base URL missing" },
      { status: 400 },
    );
  }
  const urlValidation = validateExternalBaseUrl(baseUrl);
  if (!urlValidation.ok) {
    return NextResponse.json(
      { error: urlValidation.error ?? "Inference base URL is not allowed" },
      { status: 400 },
    );
  }

  const base = normalizeBase(baseUrl);
  const candidateUrls = [`${base}/models`, `${base}/get_models`];
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  try {
    let data: any = null;
    let lastStatus: number | null = null;
    for (const modelsUrl of candidateUrls) {
      const res = await fetch(modelsUrl, {
        method: "GET",
        headers,
      });
      lastStatus = res.status;
      if (!res.ok) continue;
      data = await res.json();
      break;
    }
    if (!data) {
      throw new Error(`Model list failed with status ${lastStatus ?? "unknown"}`);
    }
    const models =
      Array.isArray(data?.data) && data.data.length > 0
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
    return NextResponse.json({ models });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load models";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
