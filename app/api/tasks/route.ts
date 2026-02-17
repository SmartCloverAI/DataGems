import { NextRequest, NextResponse } from "next/server";

import { requireAuthFromRequest } from "@/lib/auth/requireAuth";
import { listJobsForUser } from "@/lib/datagen/jobStore";
import { ensureWorkerStarted } from "@/lib/datagen/jobWorker";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireAuthFromRequest(request);
    try {
      ensureWorkerStarted();
    } catch (error) {
      console.error("Worker failed to start", error);
    }
    const jobs = await listJobsForUser(session.username);
    return NextResponse.json({ jobs });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Schema draft must be created via /api/tasks/schema" },
    { status: 405 },
  );
}
