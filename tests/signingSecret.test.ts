import { createSessionToken, parseSessionToken } from "@/lib/auth/session";
import { createDraftToken, parseDraftToken } from "@/lib/datagen/draftToken";

describe("signing secret resolver", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("falls back in development when DATAGEN_SESSION_SECRET is missing", () => {
    process.env["NODE_ENV"] = "development";
    delete process.env.DATAGEN_SESSION_SECRET;

    const token = createSessionToken({ username: "alice", role: "user" });
    const parsed = parseSessionToken(token);
    expect(parsed).toMatchObject({ username: "alice", role: "user" });
  });

  it("uses the same fallback for draft tokens", () => {
    process.env["NODE_ENV"] = "development";
    delete process.env.DATAGEN_SESSION_SECRET;

    const token = createDraftToken({
      title: "test",
      totalRecords: 1,
      description: "desc",
      instructions: "instr",
      schema: { type: "object" },
      schemaGeneratedAt: new Date().toISOString(),
      schemaDurationMs: 10,
      schemaRefreshes: 0,
    });

    const parsed = parseDraftToken(token);
    expect(parsed?.title).toBe("test");
    expect(parsed?.totalRecords).toBe(1);
  });

  it("stays strict in production when secret is missing", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env.DATAGEN_SESSION_SECRET;

    expect(() =>
      createSessionToken({ username: "alice", role: "user" }),
    ).toThrow(/DATAGEN_SESSION_SECRET/);
  });
});
