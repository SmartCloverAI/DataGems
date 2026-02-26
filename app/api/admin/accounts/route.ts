import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  AdminAccountActionError,
  deactivateAccount,
  listAdminAccounts,
} from "@/lib/auth/adminAccounts";
import { requireAuthFromRequest } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

const deleteAccountSchema = z.object({
  username: z.string().trim().min(1).max(120),
});

function requireAdmin(request: NextRequest) {
  const session = requireAuthFromRequest(request);
  if (session.role !== "admin") {
    throw new AdminAccountActionError("Forbidden", 403);
  }
  return session;
}

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
  } catch (error) {
    if (error instanceof AdminAccountActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accounts = await listAdminAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Failed to list accounts", error);
    return NextResponse.json({ error: "Failed to list accounts" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let session: { username: string } | null = null;
  try {
    session = requireAdmin(request);
  } catch (error) {
    if (error instanceof AdminAccountActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await deactivateAccount({
      actorUsername: session.username,
      targetUsername: parsed.data.username,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminAccountActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to delete account", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
