import { getCStore } from "@/lib/ratio1/client";
import { usersIndexKey } from "@/lib/ratio1/keys";
import { DataGenUserIndex } from "./types";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function upsertUserIndex(user: DataGenUserIndex) {
  const cstore = getCStore();
  const nextUser: DataGenUserIndex = {
    ...user,
    email: typeof user.email === "string" ? normalizeEmail(user.email) : user.email,
  };
  await cstore.hset({
    hkey: usersIndexKey(),
    key: nextUser.username,
    value: JSON.stringify(nextUser),
  });
  return nextUser;
}

export async function getUserIndex(username: string) {
  const cstore = getCStore();
  const raw = await cstore.hget({ hkey: usersIndexKey(), key: username });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DataGenUserIndex;
  } catch {
    return null;
  }
}

export async function getUserIndexByEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const cstore = getCStore();
  const all = await cstore.hgetall({ hkey: usersIndexKey() });
  if (!all || typeof all !== "object") return null;

  for (const value of Object.values(all as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    try {
      const parsed = JSON.parse(value) as DataGenUserIndex;
      if (
        typeof parsed?.email === "string" &&
        normalizeEmail(parsed.email) === normalized
      ) {
        return parsed;
      }
    } catch {
      // Skip malformed entry.
    }
  }

  return null;
}
