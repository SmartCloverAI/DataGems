import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSessionCookie, createSessionToken } from "@/lib/auth/session";
import { ensureAuthInitialized } from "@/lib/ratio1/auth";
import { shouldUseMockCStore } from "@/lib/ratio1/mockMode";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

function isConfigError(error: unknown) {
  const message = (error as { message?: string })?.message ?? "";
  return message.includes("Missing required environment variable");
}

function isInvalidCredentials(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  const name = (error as { name?: string })?.name ?? "";
  return code === "INVALID_CREDENTIALS" || name === "InvalidCredentialsError";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { username, password } = parsed.data;

  try {
    const auth = await ensureAuthInitialized();
    const user = await auth.simple.authenticate(username, password);
    const token = createSessionToken({
      username: user.username,
      role: (user as { role?: string }).role ?? "user",
    });

    const response = NextResponse.json({
      username: user.username,
      role: (user as { role?: string }).role ?? "user",
    });
    response.headers.append("Set-Cookie", createSessionCookie(token));
    return response;
  } catch (error) {
    console.error("Login failed", error);
    if (isConfigError(error)) {
      return NextResponse.json(
        { error: "Server auth is not configured" },
        { status: 500 },
      );
    }
    if (shouldUseMockCStore() && isInvalidCredentials(error)) {
      return NextResponse.json(
        { error: "Invalid credentials (mock mode defaults: admin/admin or test_user/testtest)." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 },
    );
  }
}
