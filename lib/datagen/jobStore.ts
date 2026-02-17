import { getCStore, resetRatioClient } from "@/lib/ratio1/client";
import {
  jobPeersHashKey,
  jobsHashKey,
  userJobsKey,
} from "@/lib/ratio1/keys";
import { DataGenJobBase, DataGenJobPeerState } from "./types";

export type UserJobSummary = {
  id: string;
  title: string;
  status: DataGenJobBase["status"];
  createdAt: string;
  updatedAt: string;
};

function normalizeJobBase(job: DataGenJobBase): DataGenJobBase {
  return {
    ...job,
    totalGenerated: job.totalGenerated ?? 0,
    totalOk: job.totalOk ?? 0,
    totalFailed: job.totalFailed ?? 0,
    updatedAt: job.updatedAt ?? job.createdAt,
  };
}

export async function createJobBase(job: DataGenJobBase) {
  const cstore = getCStore();
  await cstore.hset({
    hkey: jobsHashKey(),
    key: job.id,
    value: JSON.stringify(job),
  });
  return job;
}

export async function getJobBase(jobId: string): Promise<DataGenJobBase | null> {
  const cstore = getCStore();
  const raw = await cstore.hget({ hkey: jobsHashKey(), key: jobId });
  if (!raw) return null;
  try {
    return normalizeJobBase(JSON.parse(raw) as DataGenJobBase);
  } catch {
    return null;
  }
}

export async function updateJobBase(
  jobId: string,
  partial: Partial<DataGenJobBase>,
): Promise<DataGenJobBase | null> {
  const current = await getJobBase(jobId);
  if (!current) return null;
  const next = normalizeJobBase({
    ...current,
    ...partial,
  });
  const cstore = getCStore();
  await cstore.hset({
    hkey: jobsHashKey(),
    key: jobId,
    value: JSON.stringify(next),
  });
  await addJobToUser(next.owner, {
    id: next.id,
    title: next.title,
    status: next.status,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  });
  return next;
}

export async function setPeerState(
  jobId: string,
  peerId: string,
  state: DataGenJobPeerState,
) {
  const cstore = getCStore();
  await cstore.hset({
    hkey: jobPeersHashKey(jobId),
    key: peerId,
    value: JSON.stringify(state),
  });
  return state;
}

export async function getPeerState(
  jobId: string,
  peerId: string,
): Promise<DataGenJobPeerState | null> {
  const cstore = getCStore();
  const raw = await cstore.hget({ hkey: jobPeersHashKey(jobId), key: peerId });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DataGenJobPeerState;
  } catch {
    return null;
  }
}

export async function updatePeerState(
  jobId: string,
  peerId: string,
  partial: Partial<DataGenJobPeerState>,
): Promise<DataGenJobPeerState | null> {
  const current = await getPeerState(jobId, peerId);
  if (!current) return null;
  const next: DataGenJobPeerState = {
    ...current,
    ...partial,
  };
  return setPeerState(jobId, peerId, next);
}

export async function listPeerStates(
  jobId: string,
): Promise<DataGenJobPeerState[]> {
  const cstore = getCStore();
  const res = await cstore.hgetall({ hkey: jobPeersHashKey(jobId) });
  if (!res || typeof res !== "object") return [];
  const peers: DataGenJobPeerState[] = [];
  for (const value of Object.values(res as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    try {
      peers.push(JSON.parse(value) as DataGenJobPeerState);
    } catch {
      // ignore
    }
  }
  return peers;
}

export async function addJobToUser(
  username: string,
  summary: UserJobSummary,
) {
  const cstore = getCStore();
  await cstore.hset({
    hkey: userJobsKey(username),
    key: summary.id,
    value: JSON.stringify(summary),
  });
  return summary;
}

export async function listUserJobSummaries(
  username: string,
): Promise<UserJobSummary[]> {
  const cstore = getCStore();
  const res = await cstore.hgetall({ hkey: userJobsKey(username) });
  if (!res || typeof res !== "object") return [];
  const summaries: UserJobSummary[] = [];
  for (const value of Object.values(res as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    try {
      summaries.push(JSON.parse(value) as UserJobSummary);
    } catch {
      // ignore
    }
  }
  return summaries;
}

export async function listJobsForUser(username: string): Promise<DataGenJobBase[]> {
  const allJobs = await listAllJobs();
  return allJobs
    .filter((job) => job.owner === username)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listAllJobs(): Promise<DataGenJobBase[]> {
  const res = await hgetallWithRetry(jobsHashKey());
  if (!res || typeof res !== "object") return [];
  const jobs: DataGenJobBase[] = [];
  for (const value of Object.values(res as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    try {
      jobs.push(normalizeJobBase(JSON.parse(value) as DataGenJobBase));
    } catch {
      // ignore
    }
  }
  return jobs;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function hgetallWithRetry(hkey: string, attempts = 3) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const cstore = getCStore();
      return await cstore.hgetall({ hkey });
    } catch (error) {
      lastError = error;
      // Re-create SDK client in case the underlying socket pool is stale.
      resetRatioClient();
      if (attempt < attempts) {
        await sleep(attempt * 150);
      }
    }
  }
  throw lastError;
}

export async function listJobsForPeer(peerId: string): Promise<DataGenJobBase[]> {
  const all = await listAllJobs();
  return all.filter(
    (job) =>
      job.peers.includes(peerId) &&
      job.status !== "succeeded" &&
      job.status !== "failed",
  );
}
