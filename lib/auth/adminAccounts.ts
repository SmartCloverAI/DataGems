import type { PublicUser } from "@ratio1/cstore-auth-ts";

import { readEnv } from "@/lib/env";
import { getCStore } from "@/lib/ratio1/client";
import { ensureAuthInitialized } from "@/lib/ratio1/auth";
import { shouldUseMockCStore } from "@/lib/ratio1/mockMode";

const SOFT_DELETE_META_KEY = "__datagemsDeleted";
const SOFT_DELETE_AT_META_KEY = "__datagemsDeletedAt";
const SOFT_DELETE_BY_META_KEY = "__datagemsDeletedBy";

type AccountMetadata = Record<string, unknown>;

export type AdminAccountSummary = {
  username: string;
  email: string | null;
  country: string | null;
};

export class AdminAccountActionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function asMetadata(metadata: unknown): AccountMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return { ...(metadata as AccountMetadata) };
}

function metadataText(meta: AccountMetadata, key: string) {
  const value = meta[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isSoftDeleted(user: PublicUser<AccountMetadata>) {
  const metadata = asMetadata(user.metadata);
  return (
    metadata[SOFT_DELETE_META_KEY] === true ||
    typeof metadata[SOFT_DELETE_AT_META_KEY] === "string"
  );
}

export async function listAdminAccounts(): Promise<AdminAccountSummary[]> {
  const auth = await ensureAuthInitialized();
  const users = await auth.simple.getAllUsers<AccountMetadata>();

  return users
    .filter((user) => !isSoftDeleted(user))
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((user) => {
      const metadata = asMetadata(user.metadata);
      return {
        username: user.username,
        email: metadataText(metadata, "email"),
        country: metadataText(metadata, "country"),
      };
    });
}

export async function deactivateAccount(opts: {
  actorUsername: string;
  targetUsername: string;
}) {
  const actor = normalizeUsername(opts.actorUsername);
  const target = normalizeUsername(opts.targetUsername);

  if (!target) {
    throw new AdminAccountActionError("Username is required", 400);
  }
  if (actor === target) {
    throw new AdminAccountActionError(
      "You cannot delete your own account",
      400,
    );
  }

  const auth = await ensureAuthInitialized();
  const existing = await auth.simple.getUser<AccountMetadata>(target);
  if (!existing || isSoftDeleted(existing)) {
    throw new AdminAccountActionError("Account not found", 404);
  }

  if (shouldUseMockCStore()) {
    const mockDelete = (
      auth.simple as unknown as { deleteUser?: (username: string) => Promise<void> }
    ).deleteUser;
    if (typeof mockDelete === "function") {
      await mockDelete(existing.username);
      return;
    }
  }

  const hkey = readEnv("R1EN_CSTORE_AUTH_HKEY");
  if (!hkey) {
    throw new Error("Missing required environment variable: R1EN_CSTORE_AUTH_HKEY");
  }

  const now = new Date().toISOString();
  const nextMetadata: AccountMetadata = {
    ...asMetadata(existing.metadata),
    [SOFT_DELETE_META_KEY]: true,
    [SOFT_DELETE_AT_META_KEY]: now,
    [SOFT_DELETE_BY_META_KEY]: actor,
  };

  const replacementRecord = {
    type: "simple" as const,
    password: null,
    role: existing.role,
    metadata: nextMetadata,
    createdAt: existing.createdAt,
    updatedAt: now,
  };

  const cstore = getCStore();
  await cstore.hset({
    hkey,
    key: existing.username,
    value: JSON.stringify(replacementRecord),
  });
}
