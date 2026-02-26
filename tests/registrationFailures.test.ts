import { getCStore } from "@/lib/ratio1/client";
import { registerMailFailuresKey } from "@/lib/ratio1/keys";
import {
  markRegisterMailFailureSent,
  readRegisterMailFailureForResend,
  recordRegisterMailFailure,
} from "@/lib/auth/registrationFailures";

describe("registration mail failure store", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...envBackup,
      DATAGEN_MOCK_CSTORE: "true",
      DATAGEN_SESSION_SECRET: "test-secret",
      DATAGEN_REGISTER_FAILURE_TTL_SECONDS: "3600",
    };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("stores encrypted password and restores it for resend", async () => {
    const email = `retry-${Date.now()}@example.com`;
    await recordRegisterMailFailure({
      email,
      username: "user1",
      password: "pw-123",
    });

    const cstore = getCStore();
    const raw = await cstore.hget({ hkey: registerMailFailuresKey(), key: email });
    expect(raw).toContain("\"passwordEncrypted\"");
    expect(raw).not.toContain("pw-123");

    const record = await readRegisterMailFailureForResend(email);
    expect(record).toMatchObject({
      email,
      username: "user1",
      password: "pw-123",
    });
  });

  it("hides resend data after mark sent", async () => {
    const email = `sent-${Date.now()}@example.com`;
    await recordRegisterMailFailure({
      email,
      username: "user2",
      password: "pw-456",
    });
    await markRegisterMailFailureSent(email);

    const record = await readRegisterMailFailureForResend(email);
    expect(record).toBeNull();
  });
});
