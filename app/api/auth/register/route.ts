import { randomBytes } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendSignupEmail } from "@/lib/auth/mailer";
import { ensureAuthInitialized } from "@/lib/ratio1/auth";
import { getUserIndexByEmail, upsertUserIndex } from "@/lib/datagen/userIndex";

export const runtime = "nodejs";

const registrationSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  country: z.string().min(1).max(120),
});

function buildUsername(email: string) {
  const [localPart = "user"] = email.toLowerCase().split("@");
  const sanitized = localPart.replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  const suffix = randomBytes(2).toString("hex");
  const base = sanitized.length > 0 ? sanitized : "user";
  return `${base}_${suffix}`.slice(0, 64);
}

function generatePassword() {
  return randomBytes(12).toString("base64url");
}

function isUserExists(error: unknown) {
  const name = (error as any)?.name;
  const code = (error as any)?.code;
  const message = (error as any)?.message ?? "";
  if (name === "UserExistsError") return true;
  if (typeof code === "string" && code.toUpperCase().includes("EXIST")) return true;
  if (typeof message === "string" && message.toLowerCase().includes("exists")) return true;
  return false;
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { name, email, country } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  let username = buildUsername(normalizedEmail);
  const password = generatePassword();

  try {
    const existing = await getUserIndexByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const auth = await ensureAuthInitialized();
    let user = null as any;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        user = await auth.simple.createUser(username, password, {
          role: "user",
          metadata: { name, email: normalizedEmail, country },
        });
        break;
      } catch (error) {
        if (isUserExists(error) && attempt < 2) {
          username = buildUsername(normalizedEmail);
          continue;
        }
        throw error;
      }
    }
    await upsertUserIndex({
      username: user.username,
      name,
      email: normalizedEmail,
      country,
      createdAt: new Date().toISOString(),
    });

    await sendSignupEmail({ to: normalizedEmail, username: user.username, password });

    return NextResponse.json({
      username: user.username,
      message: "Account created. Credentials sent by email.",
    });
  } catch (error) {
    if (isUserExists(error)) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }
    console.error("Registration failed", error);
    return NextResponse.json(
      { error: "Unable to create account" },
      { status: 400 },
    );
  }
}
