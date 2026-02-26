import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

import { normalizeEmail } from "@/lib/datagen/userIndex";
import { optionalNumberEnv } from "@/lib/env";
import { getCStore } from "@/lib/ratio1/client";
import { registerMailFailuresKey } from "@/lib/ratio1/keys";
import { getSigningSecret } from "./signingSecret";

type FailureStatus = "pending" | "sent" | "expired";

type StoredRegistrationFailure = {
  email: string;
  username: string;
  passwordEncrypted?: string;
  attempts: number;
  status: FailureStatus;
  failedAt: string;
  updatedAt: string;
  lastErrorCode: string;
};

type RegistrationFailureRecord = {
  email: string;
  username: string;
  password: string;
};

function nowIso() {
  return new Date().toISOString();
}

function ttlSeconds() {
  const configured = optionalNumberEnv("DATAGEN_REGISTER_FAILURE_TTL_SECONDS", 86400);
  if (!configured || configured < 60) return 86400;
  return Math.floor(configured);
}

function keyMaterial() {
  return createHash("sha256")
    .update(getSigningSecret())
    .update(":datagen:register-failure:v1")
    .digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecret(encoded: string) {
  const [ivPart, tagPart, encryptedPart] = encoded.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Invalid encoded secret");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), iv);
  decipher.setAuthTag(tag);
  const clear = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return clear.toString("utf8");
}

function parseRecord(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredRegistrationFailure;
  } catch {
    return null;
  }
}

function isExpired(record: StoredRegistrationFailure) {
  const failedAt = Date.parse(record.failedAt);
  if (!Number.isFinite(failedAt)) return true;
  return Date.now() - failedAt > ttlSeconds() * 1000;
}

async function readStoredFailure(email: string) {
  const cstore = getCStore();
  const normalized = normalizeEmail(email);
  const raw = await cstore.hget({ hkey: registerMailFailuresKey(), key: normalized });
  return {
    normalized,
    record: parseRecord(raw),
  };
}

async function writeStoredFailure(
  normalizedEmail: string,
  record: StoredRegistrationFailure,
) {
  const cstore = getCStore();
  await cstore.hset({
    hkey: registerMailFailuresKey(),
    key: normalizedEmail,
    value: JSON.stringify(record),
  });
}

export async function recordRegisterMailFailure(opts: {
  email: string;
  username: string;
  password: string;
}) {
  const { normalized } = await readStoredFailure(opts.email);
  const now = nowIso();
  const next: StoredRegistrationFailure = {
    email: normalized,
    username: opts.username,
    passwordEncrypted: encryptSecret(opts.password),
    attempts: 1,
    status: "pending",
    failedAt: now,
    updatedAt: now,
    lastErrorCode: "delivery_failed",
  };
  await writeStoredFailure(normalized, next);
}

export async function readRegisterMailFailureForResend(
  email: string,
): Promise<RegistrationFailureRecord | null> {
  const { normalized, record } = await readStoredFailure(email);
  if (!record) return null;
  if (record.status !== "pending") return null;

  if (isExpired(record)) {
    await writeStoredFailure(normalized, {
      ...record,
      status: "expired",
      passwordEncrypted: undefined,
      updatedAt: nowIso(),
    });
    return null;
  }

  if (!record.passwordEncrypted) return null;
  try {
    return {
      email: normalized,
      username: record.username,
      password: decryptSecret(record.passwordEncrypted),
    };
  } catch {
    await writeStoredFailure(normalized, {
      ...record,
      status: "expired",
      passwordEncrypted: undefined,
      updatedAt: nowIso(),
      lastErrorCode: "decrypt_failed",
    });
    return null;
  }
}

export async function markRegisterMailFailureSent(email: string) {
  const { normalized, record } = await readStoredFailure(email);
  if (!record) return;
  await writeStoredFailure(normalized, {
    ...record,
    status: "sent",
    passwordEncrypted: undefined,
    updatedAt: nowIso(),
    lastErrorCode: "sent",
  });
}

export async function markRegisterMailFailureRetry(email: string) {
  const { normalized, record } = await readStoredFailure(email);
  if (!record) return;
  if (record.status !== "pending") return;
  await writeStoredFailure(normalized, {
    ...record,
    attempts: record.attempts + 1,
    updatedAt: nowIso(),
    lastErrorCode: "delivery_failed",
  });
}
