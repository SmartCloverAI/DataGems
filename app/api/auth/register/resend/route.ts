import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  MailerConfigError,
  resolveSmtpConfig,
  sendSignupEmail,
} from "@/lib/auth/mailer";
import {
  markRegisterMailFailureRetry,
  markRegisterMailFailureSent,
  readRegisterMailFailureForResend,
} from "@/lib/auth/registrationFailures";
import { checkRegistrationRateLimit } from "@/lib/auth/registrationRateLimit";
import { normalizeEmail } from "@/lib/datagen/userIndex";

export const runtime = "nodejs";

const resendSchema = z.object({
  email: z.string().email().max(200),
});

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    const candidate = first?.trim();
    if (candidate) return candidate;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

const GENERIC_OK_MESSAGE =
  "If credentials are eligible for resend, they were sent.";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = resendSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const rateLimitResult = await checkRegistrationRateLimit({
    ip: requestIp(request),
    email,
    kind: "resend",
  });
  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      { error: "Too many resend attempts. Please try again later." },
      { status: 429 },
    );
    if (rateLimitResult.retryAfterSeconds) {
      response.headers.set("Retry-After", String(rateLimitResult.retryAfterSeconds));
    }
    return response;
  }

  try {
    resolveSmtpConfig();
  } catch (error) {
    if (error instanceof MailerConfigError) {
      return NextResponse.json(
        { error: "Email delivery is not configured. Please try again later." },
        { status: 503 },
      );
    }
    throw error;
  }

  const failedRegistration = await readRegisterMailFailureForResend(email);
  if (!failedRegistration) {
    return NextResponse.json({ message: GENERIC_OK_MESSAGE });
  }

  try {
    await sendSignupEmail({
      to: failedRegistration.email,
      username: failedRegistration.username,
      password: failedRegistration.password,
    });
    await markRegisterMailFailureSent(email);
    return NextResponse.json({ message: GENERIC_OK_MESSAGE });
  } catch {
    await markRegisterMailFailureRetry(email);
    return NextResponse.json(
      {
        error: "Unable to resend credentials right now. Please try again later.",
      },
      { status: 502 },
    );
  }
}
