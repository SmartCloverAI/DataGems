import { checkRegistrationRateLimit } from "@/lib/auth/registrationRateLimit";

describe("registration rate limit", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...envBackup,
      DATAGEN_MOCK_CSTORE: "true",
      DATAGEN_REGISTER_RATE_WINDOW_SECONDS: "3600",
      DATAGEN_REGISTER_MAX_PER_IP: "2",
      DATAGEN_REGISTER_MAX_PER_EMAIL: "2",
      DATAGEN_REGISTER_RESEND_WINDOW_SECONDS: "3600",
      DATAGEN_REGISTER_RESEND_MAX_PER_IP: "1",
      DATAGEN_REGISTER_RESEND_MAX_PER_EMAIL: "1",
    };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("limits register calls by IP", async () => {
    const ip = `ip-${Date.now()}`;
    const emailA = `a-${Date.now()}@example.com`;
    const emailB = `b-${Date.now()}@example.com`;

    const first = await checkRegistrationRateLimit({ ip, email: emailA, kind: "register" });
    const second = await checkRegistrationRateLimit({
      ip,
      email: emailB,
      kind: "register",
    });
    const third = await checkRegistrationRateLimit({
      ip,
      email: `c-${Date.now()}@example.com`,
      kind: "register",
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  it("limits resend calls by email", async () => {
    const now = Date.now();
    const ipA = `ip-a-${now}`;
    const ipB = `ip-b-${now}`;
    const email = `retry-${now}@example.com`;

    const first = await checkRegistrationRateLimit({ ip: ipA, email, kind: "resend" });
    const second = await checkRegistrationRateLimit({ ip: ipB, email, kind: "resend" });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });
});
