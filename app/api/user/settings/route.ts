import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthFromRequest } from "@/lib/auth/requireAuth";
import { validateExternalBaseUrl } from "@/lib/security/urlValidation";
import {
  deleteInferenceProfile,
  readUserSettings,
  setActiveInferenceProfile,
  toPublicSettings,
  upsertInferenceProfile,
} from "@/lib/datagen/userSettings";

export const runtime = "nodejs";

const upsertProfileSchema = z.object({
  mode: z.literal("upsert").optional(),
  id: z.string().min(1).optional(),
  name: z.string().max(120).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().max(200).optional(),
  path: z.string().max(200).optional(),
  setActive: z.boolean().optional(),
});

const activateProfileSchema = z.object({
  mode: z.literal("activate"),
  id: z.string().min(1),
});

const bodySchema = z.union([upsertProfileSchema, activateProfileSchema]);

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET(request: NextRequest) {
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

  const settings = await readUserSettings(session.username);
  return NextResponse.json(toPublicSettings(settings));
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

  if (parsed.data.mode !== "activate" && parsed.data.baseUrl) {
    const validation = validateExternalBaseUrl(parsed.data.baseUrl);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error ?? "Inference base URL is not allowed" },
        { status: 400 },
      );
    }
  }

  try {
    let saved;
    if (parsed.data.mode === "activate") {
      saved = await setActiveInferenceProfile(session.username, parsed.data.id);
    } else {
      saved = await upsertInferenceProfile(session.username, parsed.data);
    }
    return NextResponse.json(toPublicSettings(saved));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
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
  const parsed = deleteSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const saved = await deleteInferenceProfile(session.username, parsed.data.id);
    return NextResponse.json(toPublicSettings(saved));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
