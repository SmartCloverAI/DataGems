import nodemailer from "nodemailer";

import { readEnv } from "@/lib/env";

const SMTP_KEYS = [
  "DATAGEN_SMTP_HOST",
  "DATAGEN_SMTP_PORT",
  "DATAGEN_SMTP_USER",
  "DATAGEN_SMTP_PASS",
  "DATAGEN_SMTP_FROM",
] as const;

function smtpConfig() {
  const host = readEnv("DATAGEN_SMTP_HOST");
  const portRaw = readEnv("DATAGEN_SMTP_PORT");
  const user = readEnv("DATAGEN_SMTP_USER");
  const pass = readEnv("DATAGEN_SMTP_PASS");
  const from = readEnv("DATAGEN_SMTP_FROM");
  if (!host || !portRaw || !user || !pass || !from) {
    return null;
  }
  const port = Number(portRaw);
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    user,
    pass,
    from,
  };
}

export async function sendSignupEmail(opts: {
  to: string;
  username: string;
  password: string;
}) {
  const config = smtpConfig();
  if (!config) {
    console.warn(
      "[datagen] SMTP not configured. Signup credentials:",
      `email=${opts.to} username=${opts.username} password=${opts.password}`,
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: opts.to,
    subject: "Your DataGen account credentials",
    text:
      `Welcome to DataGen!\n\n` +
      `Username: ${opts.username}\n` +
      `Password: ${opts.password}\n\n` +
      `Please sign in and change your password if needed.\n`,
  });
}
