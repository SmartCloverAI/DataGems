import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".localdomain",
] as const;

function isPrivateIpv4(host: string) {
  const octets = host.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(host: string) {
  const normalized = host.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  return false;
}

export function validateExternalBaseUrl(input: string): {
  ok: boolean;
  error?: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "Inference base URL is invalid" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Inference base URL must use http or https" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Inference base URL must not include credentials" };
  }

  const host = parsed.hostname.toLowerCase();
  const hostForIpCheck = host.replace(/^\[|\]$/g, "");
  if (!host) {
    return { ok: false, error: "Inference base URL host is missing" };
  }
  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, error: "Inference base URL host is not allowed" };
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, error: "Inference base URL host is not allowed" };
  }

  const ipVersion = isIP(hostForIpCheck);
  if (ipVersion === 4 && isPrivateIpv4(hostForIpCheck)) {
    return { ok: false, error: "Inference base URL private IPv4 addresses are not allowed" };
  }
  if (ipVersion === 6 && isPrivateIpv6(hostForIpCheck)) {
    return { ok: false, error: "Inference base URL private IPv6 addresses are not allowed" };
  }

  return { ok: true };
}
