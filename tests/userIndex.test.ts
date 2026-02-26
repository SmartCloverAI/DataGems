import {
  getUserIndexByEmail,
  normalizeEmail,
  upsertUserIndex,
} from "@/lib/datagen/userIndex";

describe("user index email lookup", () => {
  const envBackup = { ...process.env };

  beforeAll(() => {
    process.env.DATAGEN_MOCK_CSTORE = "true";
  });

  afterAll(() => {
    process.env = { ...envBackup };
  });

  it("normalizes emails consistently", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  it("stores and resolves user by normalized email index", async () => {
    const timestamp = Date.now();
    const username = `user_${timestamp}`;
    const email = `user_${timestamp}@example.com`;
    await upsertUserIndex({
      username,
      email,
      name: "User",
      country: "US",
      createdAt: new Date().toISOString(),
    });

    const stored = await getUserIndexByEmail(`  ${email.toUpperCase()}  `);
    expect(stored?.username).toBe(username);
    expect(stored?.email).toBe(email);
  });

  it("returns null for unknown email", async () => {
    const missing = await getUserIndexByEmail("nobody@example.com");
    expect(missing).toBeNull();
  });
});
