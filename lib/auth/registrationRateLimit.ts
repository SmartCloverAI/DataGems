import { optionalNumberEnv } from "@/lib/env";
import { getCStore } from "@/lib/ratio1/client";

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type RateLimitCheck = {
  ip: string;
  email: string;
  kind: "register" | "resend";
};

function safeSubject(input: string) {
  return encodeURIComponent(input.trim().toLowerCase() || "unknown");
}

function toPositiveInt(value: number | undefined, fallback: number) {
  if (!value || !Number.isFinite(value)) return fallback;
  return value > 0 ? Math.floor(value) : fallback;
}

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function consumeBucket(
  keyPrefix: string,
  subject: string,
  windowSeconds: number,
  maxPerWindow: number,
) {
  const cstore = getCStore();
  const now = nowEpochSeconds();
  const bucket = Math.floor(now / windowSeconds);
  const key = `${keyPrefix}:${safeSubject(subject)}:${bucket}`;
  const raw = await cstore.getValue({ key });
  const current = Number.parseInt(raw ?? "0", 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  await cstore.setValue({ key, value: String(next) });
  const resetAt = (bucket + 1) * windowSeconds;
  return {
    allowed: next <= maxPerWindow,
    retryAfterSeconds: Math.max(1, resetAt - now),
  };
}

export async function checkRegistrationRateLimit(
  opts: RateLimitCheck,
): Promise<RateLimitResult> {
  const isResend = opts.kind === "resend";
  const windowSeconds = toPositiveInt(
    optionalNumberEnv(
      isResend
        ? "DATAGEN_REGISTER_RESEND_WINDOW_SECONDS"
        : "DATAGEN_REGISTER_RATE_WINDOW_SECONDS",
    ),
    900,
  );
  const maxPerIp = toPositiveInt(
    optionalNumberEnv(
      isResend
        ? "DATAGEN_REGISTER_RESEND_MAX_PER_IP"
        : "DATAGEN_REGISTER_MAX_PER_IP",
    ),
    isResend ? 5 : 10,
  );
  const maxPerEmail = toPositiveInt(
    optionalNumberEnv(
      isResend
        ? "DATAGEN_REGISTER_RESEND_MAX_PER_EMAIL"
        : "DATAGEN_REGISTER_MAX_PER_EMAIL",
    ),
    isResend ? 2 : 3,
  );

  const ipResult = await consumeBucket(
    isResend ? "datagen:rate:register:resend:ip" : "datagen:rate:register:ip",
    opts.ip,
    windowSeconds,
    maxPerIp,
  );
  if (!ipResult.allowed) return ipResult;

  const emailResult = await consumeBucket(
    isResend
      ? "datagen:rate:register:resend:email"
      : "datagen:rate:register:email",
    opts.email,
    windowSeconds,
    maxPerEmail,
  );
  if (!emailResult.allowed) return emailResult;

  return { allowed: true };
}
