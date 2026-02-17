import { NextRequest, NextResponse } from "next/server";

import { requireAuthFromRequest } from "@/lib/auth/requireAuth";
import { ensureWorkerStarted } from "@/lib/datagen/jobWorker";
import { getJobBase, listPeerStates } from "@/lib/datagen/jobStore";
import { downloadText } from "@/lib/ratio1/r1fs";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
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

  const { id } = await (context as any).params;
  const job = await getJobBase(id);
  if (!job || job.owner !== session.username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    ensureWorkerStarted();
  } catch (error) {
    console.error("Worker failed to start", error);
  }

  const peers = await listPeerStates(id);
  const peersWithErrors = await Promise.all(
    peers.map(async (peer) => {
      if (!peer.errorsCid) return peer;
      try {
        const payload = await downloadText(peer.errorsCid);
        const parsed = JSON.parse(payload);
        if (Array.isArray(parsed)) {
          return { ...peer, errors: parsed };
        }
      } catch {
        // If errors payload is unavailable, return peer state without hydration.
      }
      return peer;
    }),
  );
  let details: unknown = null;
  try {
    const payload = await downloadText(job.jobDetailsCid);
    details = JSON.parse(payload);
  } catch (error) {
    details = { error: "Unable to load job details" };
  }

  return NextResponse.json({ job, peers: peersWithErrors, details });
}
