import nodemailer from "nodemailer";

import { readEnv } from "@/lib/env";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
};

export class MailerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailerConfigError";
  }
}

export function resolveSmtpConfig(): SmtpConfig {
  const host = readEnv("DATAGEN_SMTP_HOST")?.trim();
  const portRaw = readEnv("DATAGEN_SMTP_PORT")?.trim();
  const user = readEnv("DATAGEN_SMTP_USER")?.trim();
  const pass = readEnv("DATAGEN_SMTP_PASS") ?? "";
  const from = readEnv("DATAGEN_SMTP_FROM")?.trim();
  if (!host || !portRaw || !user || !from) {
    throw new MailerConfigError("SMTP host, port, user, and from must be configured");
  }
  if (!pass) {
    throw new MailerConfigError("SMTP password/API key is not configured");
  }
  const port = Number(portRaw);
  const normalizedPort = Number.isFinite(port) ? port : 587;
  return {
    host,
    port: normalizedPort,
    user,
    pass,
    from,
    secure: normalizedPort === 465,
  };
}

export async function sendSignupEmail(opts: {
  to: string;
  username: string;
  password: string;
}) {
  const config = resolveSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to: opts.to,
      subject: "Your DataGems account credentials",
      text:
        `Welcome to DataGems!\n\n` +
        `Username: ${opts.username}\n` +
        `Password: ${opts.password}\n\n` +
        `Please sign in and change your password if needed.\n`,
    });
  } catch (error) {
    throw new Error("Failed to send signup email", { cause: error });
  }
}
