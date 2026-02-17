import { NextRequest, NextResponse } from "next/server";

import { requireAuthFromRequest } from "@/lib/auth/requireAuth";
import { normalizeResultsForCsv, toCsv } from "@/lib/datagen/exporters";
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

  if (job.status !== "succeeded") {
    return NextResponse.json(
      { error: "Job not completed" },
      { status: 400 },
    );
  }

  const peerStates = await listPeerStates(id);
  const resultMap = new Map<number, unknown>();
  for (const peer of peerStates) {
    if (!peer.resultCid) continue;
    const content = await downloadText(peer.resultCid);
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { i: number; ok: boolean; data?: unknown };
        if (parsed.ok && typeof parsed.i === "number") {
          resultMap.set(parsed.i, parsed.data ?? null);
        }
      } catch {
        // ignore malformed lines
      }
    }
  }

  const results: unknown[] = [];
  for (let i = 0; i < job.totalRecords; i += 1) {
    results.push(resultMap.has(i) ? resultMap.get(i) : null);
  }

  const format = request.nextUrl.searchParams.get("format") || "json";
  if (format === "csv") {
    const rows = normalizeResultsForCsv(results);
    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${job.id}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(results, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${job.id}.json"`,
    },
  });
}
