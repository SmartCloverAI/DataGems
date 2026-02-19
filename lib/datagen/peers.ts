import { optionalNumberEnv, readEnv, requiredEnv } from "@/lib/env";
import { shouldUseMockCStore } from "@/lib/ratio1/mockMode";

export const DEFAULT_JOB_POLL_SECONDS = 5;
export const DEFAULT_UPDATE_EVERY_K = 5;
export const DEFAULT_MAX_CONCURRENT_JOBS = 1;
const DEFAULT_MOCK_PEER = "local";

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("\"") && value.endsWith("\""))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parsePeers(rawInput: string): string[] {
  const raw = stripWrappingQuotes(rawInput.trim());
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((peer) => String(peer).trim())
          .filter((peer) => peer.length > 0);
      }
    } catch {
      // Fall through to comma-separated parsing.
    }
  }

  return raw
    .split(",")
    .map((peer) => peer.trim())
    .filter((peer) => peer.length > 0);
}

export function getPeerList(): string[] {
  const raw = readEnv("R1EN_CHAINSTORE_PEERS");
  if (!raw) {
    if (shouldUseMockCStore()) {
      const current = readEnv("R1EN_HOST_ADDR")?.trim();
      return [current || DEFAULT_MOCK_PEER];
    }
    throw new Error(
      `Missing required environment variable: ${"R1EN_CHAINSTORE_PEERS"}`,
    );
  }
  const peers = parsePeers(raw);
  if (peers.length === 0) {
    if (shouldUseMockCStore()) {
      return [DEFAULT_MOCK_PEER];
    }
    throw new Error("No peers parsed from R1EN_CHAINSTORE_PEERS");
  }
  return peers;
}

export function getPeerId(): string {
  const peerId = readEnv("R1EN_HOST_ADDR")?.trim();
  if (peerId) return peerId;
  if (shouldUseMockCStore()) {
    return getPeerList()[0] ?? DEFAULT_MOCK_PEER;
  }
  const requiredPeerId = requiredEnv("R1EN_HOST_ADDR").trim();
  if (!requiredPeerId) {
    throw new Error("R1EN_HOST_ADDR is required");
  }
  return requiredPeerId;
}

export function ensurePeerConfig() {
  const peers = getPeerList();
  const peerId = getPeerId();
  if (!peers.includes(peerId)) {
    throw new Error(`R1EN_HOST_ADDR ${peerId} not in R1EN_CHAINSTORE_PEERS`);
  }
  return { peers, peerId };
}

export function splitAssignments(total: number, peers: string[]) {
  const assignments: Array<{
    peerId: string;
    assigned: number;
    range: { start: number; end: number };
  }> = [];
  const count = peers.length;
  const base = Math.floor(total / count);
  const remainder = total % count;
  let cursor = 0;
  peers.forEach((peerId, index) => {
    const assigned = base + (index < remainder ? 1 : 0);
    const start = cursor;
    const end = cursor + assigned;
    assignments.push({ peerId, assigned, range: { start, end } });
    cursor = end;
  });
  return assignments;
}

export function getJobPollSeconds() {
  return optionalNumberEnv("DATAGEN_JOB_POLL_SECONDS", DEFAULT_JOB_POLL_SECONDS) ??
    DEFAULT_JOB_POLL_SECONDS;
}

export function getUpdateEveryK() {
  return optionalNumberEnv("DATAGEN_UPDATE_EVERY_K_REQUESTS", DEFAULT_UPDATE_EVERY_K) ??
    DEFAULT_UPDATE_EVERY_K;
}

export function getMaxConcurrentJobs() {
  return optionalNumberEnv(
    "DATAGEN_MAX_CONCURRENT_JOBS_PER_INSTANCE",
    DEFAULT_MAX_CONCURRENT_JOBS,
  ) ?? DEFAULT_MAX_CONCURRENT_JOBS;
}
