import { randomBytes } from "crypto";

import { optionalNumberEnv } from "@/lib/env";
import { getCStore } from "@/lib/ratio1/client";
import { userSettingsKey } from "@/lib/ratio1/keys";

export type InferenceProfile = {
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  path?: string;
  createdAt: string;
  updatedAt: string;
};

export type UserInferenceSettings = {
  activeProfileId?: string;
  profiles: InferenceProfile[];
};

export type PublicInferenceProfile = {
  id: string;
  name: string;
  baseUrl: string | null;
  model: string | null;
  path: string | null;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicUserInferenceSettings = {
  activeProfileId: string | null;
  maxProfiles: number;
  profiles: PublicInferenceProfile[];
  activeProfile: PublicInferenceProfile | null;
  // Backward-compatible top-level fields used by existing UI/API call paths.
  baseUrl: string | null;
  model: string | null;
  path: string | null;
  hasApiKey: boolean;
};

export const DEFAULT_MAX_EXTERNAL_API_CONFIGS =
  optionalNumberEnv("DATAGEN_MAX_EXTERNAL_API_CONFIGS", 10) ?? 10;

function normalizeLegacyRecord(
  value: Record<string, unknown>,
): UserInferenceSettings | null {
  const hasLegacyFields =
    typeof value.baseUrl === "string" ||
    typeof value.apiKey === "string" ||
    typeof value.model === "string" ||
    typeof value.path === "string";
  if (!hasLegacyFields) return null;

  const now = new Date().toISOString();
  return {
    activeProfileId: "default",
    profiles: [
      {
        id: "default",
        name: "Default",
        baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : undefined,
        apiKey: typeof value.apiKey === "string" ? value.apiKey : undefined,
        model: typeof value.model === "string" ? value.model : undefined,
        path: typeof value.path === "string" ? value.path : undefined,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function normalizeProfile(input: InferenceProfile): InferenceProfile {
  return {
    ...input,
    name: input.name || "Profile",
    baseUrl: input.baseUrl ?? undefined,
    apiKey: input.apiKey ?? undefined,
    model: input.model ?? undefined,
    path: input.path ?? undefined,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function normalizeSettings(input: unknown): UserInferenceSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { profiles: [], activeProfileId: undefined };
  }

  const value = input as Record<string, unknown>;
  const legacy = normalizeLegacyRecord(value);
  if (legacy) {
    return legacy;
  }

  const rawProfiles = Array.isArray(value.profiles) ? value.profiles : [];
  const profiles = rawProfiles
    .filter((item): item is InferenceProfile => Boolean(item && typeof item === "object"))
    .map((item) => {
      const now = new Date().toISOString();
      const profile = item as Record<string, unknown>;
      return normalizeProfile({
        id: typeof profile.id === "string" ? profile.id : randomBytes(6).toString("hex"),
        name: typeof profile.name === "string" ? profile.name : "Profile",
        baseUrl: typeof profile.baseUrl === "string" ? profile.baseUrl : undefined,
        apiKey: typeof profile.apiKey === "string" ? profile.apiKey : undefined,
        model: typeof profile.model === "string" ? profile.model : undefined,
        path: typeof profile.path === "string" ? profile.path : undefined,
        createdAt:
          typeof profile.createdAt === "string" ? profile.createdAt : now,
        updatedAt:
          typeof profile.updatedAt === "string" ? profile.updatedAt : now,
      });
    });

  const activeProfileId =
    typeof value.activeProfileId === "string" ? value.activeProfileId : undefined;

  return {
    profiles,
    activeProfileId,
  };
}

export async function readUserSettings(
  username: string,
): Promise<UserInferenceSettings> {
  const cstore = getCStore();
  const raw = await cstore.getValue({ key: userSettingsKey(username) });
  if (!raw) return { profiles: [], activeProfileId: undefined };
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { profiles: [], activeProfileId: undefined };
  }
}

export async function persistUserSettings(
  username: string,
  settings: UserInferenceSettings,
): Promise<UserInferenceSettings> {
  const normalized = normalizeSettings(settings);
  const cstore = getCStore();
  await cstore.setValue({
    key: userSettingsKey(username),
    value: JSON.stringify(normalized),
  });
  return normalized;
}

export function getActiveProfile(settings: UserInferenceSettings): InferenceProfile | null {
  if (!settings.profiles.length) return null;
  if (settings.activeProfileId) {
    const exact = settings.profiles.find((profile) => profile.id === settings.activeProfileId);
    if (exact) return exact;
  }
  return settings.profiles[0] ?? null;
}

export function getProfileById(
  settings: UserInferenceSettings,
  profileId: string | undefined,
): InferenceProfile | null {
  if (!profileId) return null;
  return settings.profiles.find((profile) => profile.id === profileId) ?? null;
}

export async function upsertInferenceProfile(
  username: string,
  input: {
    id?: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    path?: string;
    setActive?: boolean;
  },
): Promise<UserInferenceSettings> {
  const settings = await readUserSettings(username);
  const now = new Date().toISOString();

  let nextProfiles = [...settings.profiles];
  let targetId = input.id;

  if (targetId) {
    const idx = nextProfiles.findIndex((profile) => profile.id === targetId);
    if (idx === -1) {
      throw new Error(`Profile ${targetId} not found`);
    }
    const current = nextProfiles[idx];
    nextProfiles[idx] = {
      ...current,
      name: input.name ?? current.name,
      baseUrl: input.baseUrl ?? current.baseUrl,
      apiKey: input.apiKey ?? current.apiKey,
      model: input.model ?? current.model,
      path: input.path ?? current.path,
      updatedAt: now,
    };
  } else {
    if (nextProfiles.length >= DEFAULT_MAX_EXTERNAL_API_CONFIGS) {
      throw new Error(
        `Maximum external API profiles reached (${DEFAULT_MAX_EXTERNAL_API_CONFIGS})`,
      );
    }
    targetId = randomBytes(6).toString("hex");
    nextProfiles.push({
      id: targetId,
      name: input.name?.trim() || `Profile ${nextProfiles.length + 1}`,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      model: input.model,
      path: input.path,
      createdAt: now,
      updatedAt: now,
    });
  }

  const next: UserInferenceSettings = {
    profiles: nextProfiles,
    activeProfileId:
      input.setActive || !settings.activeProfileId
        ? targetId
        : settings.activeProfileId,
  };

  return persistUserSettings(username, next);
}

export async function setActiveInferenceProfile(
  username: string,
  profileId: string,
): Promise<UserInferenceSettings> {
  const settings = await readUserSettings(username);
  if (!settings.profiles.some((profile) => profile.id === profileId)) {
    throw new Error(`Profile ${profileId} not found`);
  }
  return persistUserSettings(username, {
    ...settings,
    activeProfileId: profileId,
  });
}

export async function deleteInferenceProfile(
  username: string,
  profileId: string,
): Promise<UserInferenceSettings> {
  const settings = await readUserSettings(username);
  const nextProfiles = settings.profiles.filter((profile) => profile.id !== profileId);
  if (nextProfiles.length === settings.profiles.length) {
    throw new Error(`Profile ${profileId} not found`);
  }
  const nextActive =
    settings.activeProfileId === profileId
      ? nextProfiles[0]?.id
      : settings.activeProfileId;

  return persistUserSettings(username, {
    profiles: nextProfiles,
    activeProfileId: nextActive,
  });
}

export function toPublicSettings(
  settings: UserInferenceSettings,
): PublicUserInferenceSettings {
  const profiles: PublicInferenceProfile[] = settings.profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl ?? null,
    model: profile.model ?? null,
    path: profile.path ?? null,
    hasApiKey: Boolean(profile.apiKey),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }));
  const active = getActiveProfile(settings);

  return {
    activeProfileId: active?.id ?? null,
    maxProfiles: DEFAULT_MAX_EXTERNAL_API_CONFIGS,
    profiles,
    activeProfile: active
      ? {
          id: active.id,
          name: active.name,
          baseUrl: active.baseUrl ?? null,
          model: active.model ?? null,
          path: active.path ?? null,
          hasApiKey: Boolean(active.apiKey),
          createdAt: active.createdAt,
          updatedAt: active.updatedAt,
        }
      : null,
    baseUrl: active?.baseUrl ?? null,
    model: active?.model ?? null,
    path: active?.path ?? null,
    hasApiKey: Boolean(active?.apiKey),
  };
}
