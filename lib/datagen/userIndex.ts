import { getCStore } from "@/lib/ratio1/client";
import { userEmailIndexKey, usersIndexKey } from "@/lib/ratio1/keys";
import { DataGenUserIndex } from "./types";

export function normalizeEmail(email: string) {
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
  if (nextUser.email) {
    await cstore.hset({
      hkey: userEmailIndexKey(),
      key: nextUser.email,
      value: nextUser.username,
    });
  }
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
  const username = await cstore.hget({ hkey: userEmailIndexKey(), key: normalized });
  if (!username || typeof username !== "string") return null;
  return getUserIndex(username);
}
