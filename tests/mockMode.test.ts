import { shouldUseMockCStore } from "@/lib/ratio1/mockMode";

describe("mock mode resolver", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("enables mock mode when explicitly requested", () => {
    process.env["NODE_ENV"] = "production";
    process.env.DATAGEN_MOCK_CSTORE = "true";
    expect(shouldUseMockCStore()).toBe(true);
  });

  it("auto-enables mock mode in development when auth/cstore env is missing", () => {
    process.env["NODE_ENV"] = "development";
    delete process.env.DATAGEN_MOCK_CSTORE;
    delete process.env.R1EN_CSTORE_AUTH_HKEY;
    delete process.env.R1EN_CSTORE_AUTH_SECRET;
    delete process.env.R1EN_CSTORE_AUTH_BOOTSTRAP_ADMIN_PWD;
    delete process.env.EE_CHAINSTORE_API_HOST;
    delete process.env.EE_CHAINSTORE_API_URL;
    delete process.env.CSTORE_API_HOST;

    expect(shouldUseMockCStore()).toBe(true);
  });

  it("stays strict in production when not explicitly enabled", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env.DATAGEN_MOCK_CSTORE;
    delete process.env.R1EN_CSTORE_AUTH_HKEY;
    delete process.env.R1EN_CSTORE_AUTH_SECRET;
    delete process.env.R1EN_CSTORE_AUTH_BOOTSTRAP_ADMIN_PWD;
    delete process.env.EE_CHAINSTORE_API_HOST;
    delete process.env.EE_CHAINSTORE_API_URL;
    delete process.env.CSTORE_API_HOST;

    expect(shouldUseMockCStore()).toBe(false);
  });
});
