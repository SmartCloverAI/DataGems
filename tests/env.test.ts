import { readEnv } from "@/lib/env";

const originalEnv: Record<string, string | undefined> = {};
const touched: Set<string> = new Set();

function setEnv(key: string, value: string) {
  if (!touched.has(key)) {
    originalEnv[key] = process.env[key];
    touched.add(key);
  }
  process.env[key] = value;
}

function unsetEnv(key: string) {
  if (!touched.has(key)) {
    originalEnv[key] = process.env[key];
    touched.add(key);
  }
  delete process.env[key];
}

afterEach(() => {
  for (const key of touched) {
    const original = originalEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
  touched.clear();
});

describe("environment expansion", () => {
  it("expands referenced variables in place", () => {
    setEnv("HOST_NAME", "localhost");
    setEnv("PORT_NUMBER", "8080");
    setEnv("SERVICE_URL", "http://$HOST_NAME:${PORT_NUMBER}");

    expect(readEnv("SERVICE_URL")).toBe("http://localhost:8080");
  });

  it("supports escaping with $$", () => {
    setEnv("PRICE", "Cost is $$5");
    expect(readEnv("PRICE")).toBe("Cost is $5");
  });

  it("detects cycles between variables", () => {
    setEnv("A", "$B");
    setEnv("B", "$A");

    expect(() => readEnv("A")).toThrow(/cycle/i);
  });

  it("returns documented defaults for app and inference host/port", () => {
    setEnv("R1EN_HOST_IP", "172.18.0.3");
    setEnv("API_PORT", "15035");
    unsetEnv("DATAGEN_APP_HOST");
    unsetEnv("DATAGEN_APP_PORT");
    unsetEnv("DATAGEN_INFERENCE_HOST");
    unsetEnv("DATAGEN_INFERENCE_PORT");

    expect(readEnv("DATAGEN_APP_HOST")).toBe("172.18.0.3");
    expect(readEnv("DATAGEN_APP_PORT")).toBe("3000");
    expect(readEnv("DATAGEN_INFERENCE_HOST")).toBe("172.18.0.3");
    expect(readEnv("DATAGEN_INFERENCE_PORT")).toBe("15035");
  });

  it("returns PoC defaults for SMTP and registration rate settings", () => {
    unsetEnv("DATAGEN_SMTP_HOST");
    unsetEnv("DATAGEN_SMTP_PORT");
    unsetEnv("DATAGEN_SMTP_USER");
    unsetEnv("DATAGEN_SMTP_FROM");
    unsetEnv("DATAGEN_SMTP_PASS");
    unsetEnv("DATAGEN_REGISTER_RATE_WINDOW_SECONDS");
    unsetEnv("DATAGEN_REGISTER_MAX_PER_IP");
    unsetEnv("DATAGEN_REGISTER_MAX_PER_EMAIL");
    unsetEnv("DATAGEN_REGISTER_RESEND_WINDOW_SECONDS");
    unsetEnv("DATAGEN_REGISTER_RESEND_MAX_PER_IP");
    unsetEnv("DATAGEN_REGISTER_RESEND_MAX_PER_EMAIL");
    unsetEnv("DATAGEN_REGISTER_FAILURE_TTL_SECONDS");

    expect(readEnv("DATAGEN_SMTP_HOST")).toBe("smtp.resend.com");
    expect(readEnv("DATAGEN_SMTP_PORT")).toBe("465");
    expect(readEnv("DATAGEN_SMTP_USER")).toBe("resend");
    expect(readEnv("DATAGEN_SMTP_FROM")).toBe("no-reply@datagems.app");
    expect(readEnv("DATAGEN_SMTP_PASS")).toBe("");
    expect(readEnv("DATAGEN_REGISTER_RATE_WINDOW_SECONDS")).toBe("900");
    expect(readEnv("DATAGEN_REGISTER_MAX_PER_IP")).toBe("10");
    expect(readEnv("DATAGEN_REGISTER_MAX_PER_EMAIL")).toBe("3");
    expect(readEnv("DATAGEN_REGISTER_RESEND_WINDOW_SECONDS")).toBe("900");
    expect(readEnv("DATAGEN_REGISTER_RESEND_MAX_PER_IP")).toBe("5");
    expect(readEnv("DATAGEN_REGISTER_RESEND_MAX_PER_EMAIL")).toBe("2");
    expect(readEnv("DATAGEN_REGISTER_FAILURE_TTL_SECONDS")).toBe("86400");
  });
});
