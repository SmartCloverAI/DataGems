import { NextRequest } from "next/server";
import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendSignupEmail: vi.fn(),
  resolveSmtpConfig: vi.fn(),
  MailerConfigError: class MailerConfigError extends Error {},
  recordRegisterMailFailure: vi.fn(),
  markRegisterMailFailureRetry: vi.fn(),
  markRegisterMailFailureSent: vi.fn(),
  readRegisterMailFailureForResend: vi.fn(),
  checkRegistrationRateLimit: vi.fn(),
  getUserIndexByEmail: vi.fn(),
  upsertUserIndex: vi.fn(),
  createUser: vi.fn(),
  ensureAuthInitialized: vi.fn(),
}));

vi.mock("@/lib/auth/mailer", () => ({
  sendSignupEmail: mocks.sendSignupEmail,
  resolveSmtpConfig: mocks.resolveSmtpConfig,
  MailerConfigError: mocks.MailerConfigError,
}));

vi.mock("@/lib/auth/registrationFailures", () => ({
  recordRegisterMailFailure: mocks.recordRegisterMailFailure,
  readRegisterMailFailureForResend: mocks.readRegisterMailFailureForResend,
  markRegisterMailFailureRetry: mocks.markRegisterMailFailureRetry,
  markRegisterMailFailureSent: mocks.markRegisterMailFailureSent,
}));

vi.mock("@/lib/auth/registrationRateLimit", () => ({
  checkRegistrationRateLimit: mocks.checkRegistrationRateLimit,
}));

vi.mock("@/lib/datagen/userIndex", () => ({
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
  getUserIndexByEmail: mocks.getUserIndexByEmail,
  upsertUserIndex: mocks.upsertUserIndex,
}));

vi.mock("@/lib/ratio1/auth", () => ({
  ensureAuthInitialized: mocks.ensureAuthInitialized,
}));

import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as resendPost } from "@/app/api/auth/register/resend/route";

describe("register + resend routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRegistrationRateLimit.mockResolvedValue({ allowed: true });
    mocks.getUserIndexByEmail.mockResolvedValue(null);
    mocks.upsertUserIndex.mockResolvedValue(undefined);
    mocks.resolveSmtpConfig.mockReturnValue({
      host: "smtp.resend.com",
      port: 465,
      user: "resend",
      pass: "key",
      from: "no-reply@datagems.app",
      secure: true,
    });
    mocks.sendSignupEmail.mockResolvedValue(undefined);
    mocks.recordRegisterMailFailure.mockResolvedValue(undefined);
    mocks.readRegisterMailFailureForResend.mockResolvedValue(null);
    mocks.markRegisterMailFailureRetry.mockResolvedValue(undefined);
    mocks.markRegisterMailFailureSent.mockResolvedValue(undefined);
    mocks.createUser.mockResolvedValue({ username: "alice_1" });
    mocks.ensureAuthInitialized.mockResolvedValue({
      simple: {
        createUser: mocks.createUser,
      },
    });
  });

  it("register returns success and sends credentials email", async () => {
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "alice@example.com",
        country: "US",
      }),
    });

    const response = await registerPost(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.username).toBe("alice_1");
    expect(mocks.sendSignupEmail).toHaveBeenCalledTimes(1);
    expect(mocks.recordRegisterMailFailure).not.toHaveBeenCalled();
  });

  it("register enforces rate limits", async () => {
    mocks.checkRegistrationRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 30,
    });
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "alice@example.com",
        country: "US",
      }),
    });

    const response = await registerPost(request);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("register fails before user creation when mailer is not configured", async () => {
    mocks.resolveSmtpConfig.mockImplementationOnce(() => {
      throw new mocks.MailerConfigError("missing key");
    });
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "alice@example.com",
        country: "US",
      }),
    });

    const response = await registerPost(request);
    expect(response.status).toBe(503);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.sendSignupEmail).not.toHaveBeenCalled();
  });

  it("register stores failure metadata when email delivery fails", async () => {
    mocks.sendSignupEmail.mockRejectedValueOnce(new Error("smtp down"));
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "alice@example.com",
        country: "US",
      }),
    });

    const response = await registerPost(request);
    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.canResend).toBe(true);
    expect(mocks.recordRegisterMailFailure).toHaveBeenCalledTimes(1);
  });

  it("resend returns generic success when no failed delivery exists", async () => {
    mocks.readRegisterMailFailureForResend.mockResolvedValueOnce(null);
    const request = new NextRequest("http://localhost/api/auth/register/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com" }),
    });

    const response = await resendPost(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message).toBeTruthy();
    expect(mocks.sendSignupEmail).not.toHaveBeenCalled();
  });

  it("resend fails when mailer is not configured", async () => {
    mocks.resolveSmtpConfig.mockImplementationOnce(() => {
      throw new mocks.MailerConfigError("missing key");
    });
    const request = new NextRequest("http://localhost/api/auth/register/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com" }),
    });

    const response = await resendPost(request);
    expect(response.status).toBe(503);
    expect(mocks.sendSignupEmail).not.toHaveBeenCalled();
  });

  it("resend sends credentials from failure store and marks success", async () => {
    mocks.readRegisterMailFailureForResend.mockResolvedValueOnce({
      email: "alice@example.com",
      username: "alice_1",
      password: "secret",
    });
    const request = new NextRequest("http://localhost/api/auth/register/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com" }),
    });

    const response = await resendPost(request);
    expect(response.status).toBe(200);
    expect(mocks.sendSignupEmail).toHaveBeenCalledTimes(1);
    expect(mocks.markRegisterMailFailureSent).toHaveBeenCalledTimes(1);
  });

  it("resend returns retriable error when provider send fails", async () => {
    mocks.readRegisterMailFailureForResend.mockResolvedValueOnce({
      email: "alice@example.com",
      username: "alice_1",
      password: "secret",
    });
    mocks.sendSignupEmail.mockRejectedValueOnce(new Error("smtp down"));
    const request = new NextRequest("http://localhost/api/auth/register/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com" }),
    });

    const response = await resendPost(request);
    expect(response.status).toBe(502);
    expect(mocks.markRegisterMailFailureRetry).toHaveBeenCalledTimes(1);
  });
});
