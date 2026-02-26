import { vi } from "vitest";

const createTransportMock = vi.fn();

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

describe("mailer", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    createTransportMock.mockReset();
    vi.restoreAllMocks();
  });

  it("throws MailerConfigError when SMTP password is missing", async () => {
    process.env.DATAGEN_SMTP_PASS = "";
    const { MailerConfigError, resolveSmtpConfig } = await import("@/lib/auth/mailer");
    expect(() => resolveSmtpConfig()).toThrow(MailerConfigError);
  });

  it("uses secure SMTP mode on port 465", async () => {
    process.env.DATAGEN_SMTP_HOST = "smtp.resend.com";
    process.env.DATAGEN_SMTP_PORT = "465";
    process.env.DATAGEN_SMTP_USER = "resend";
    process.env.DATAGEN_SMTP_PASS = "test-api-key";
    process.env.DATAGEN_SMTP_FROM = "no-reply@datagems.app";

    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    createTransportMock.mockReturnValue({ sendMail });

    const { sendSignupEmail } = await import("@/lib/auth/mailer");
    await sendSignupEmail({
      to: "alice@example.com",
      username: "alice",
      password: "secret",
    });

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(createTransportMock.mock.calls[0]?.[0]).toMatchObject({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      requireTLS: false,
    });
  });

  it("uses STARTTLS mode on non-465 ports", async () => {
    process.env.DATAGEN_SMTP_HOST = "smtp.resend.com";
    process.env.DATAGEN_SMTP_PORT = "587";
    process.env.DATAGEN_SMTP_USER = "resend";
    process.env.DATAGEN_SMTP_PASS = "test-api-key";
    process.env.DATAGEN_SMTP_FROM = "no-reply@datagems.app";

    const sendMail = vi.fn().mockResolvedValue({ messageId: "ok" });
    createTransportMock.mockReturnValue({ sendMail });

    const { sendSignupEmail } = await import("@/lib/auth/mailer");
    await sendSignupEmail({
      to: "bob@example.com",
      username: "bob",
      password: "secret",
    });

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(createTransportMock.mock.calls[0]?.[0]).toMatchObject({
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      requireTLS: true,
    });
  });
});
