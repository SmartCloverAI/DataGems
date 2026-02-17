import { createDraftToken, parseDraftToken } from "@/lib/datagen/draftToken";

describe("draft token", () => {
  beforeAll(() => {
    process.env.DATAGEN_SESSION_SECRET = "draft-secret";
  });

  it("round-trips payload", () => {
    const token = createDraftToken({
      title: "Test",
      totalRecords: 5,
      description: "desc",
      instructions: "instr",
      schema: { type: "object" },
      schemaGeneratedAt: new Date().toISOString(),
      schemaDurationMs: 123,
      schemaRefreshes: 0,
      datasetMode: false,
      inferenceModel: "model",
      inferenceParams: { temperature: 0.2 },
    });

    const parsed = parseDraftToken(token);
    expect(parsed?.title).toBe("Test");
    expect(parsed?.totalRecords).toBe(5);
    expect(parsed?.schemaDurationMs).toBe(123);
    expect(parsed?.inferenceParams).toMatchObject({ temperature: 0.2 });
  });
});
