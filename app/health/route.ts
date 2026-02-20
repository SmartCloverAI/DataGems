import { NextResponse } from "next/server";

import { getAppVersion } from "@/lib/version";

export const runtime = "nodejs";

export async function GET() {
  const version = await getAppVersion();
  return NextResponse.json({
    ok: true,
    version,
    timestamp: new Date().toISOString(),
    serving_node: process.env.R1EN_HOST_ID ?? null,
  });
}
