import { sanitizeSchema, validateJsonSchema } from "@/lib/datagen/schemaValidation";

describe("schema validation", () => {
  it("accepts a basic object schema", () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    };
    const result = validateJsonSchema(schema);
    expect(result.valid).toBe(true);
  });

  it("rejects non-object schema", () => {
    const result = validateJsonSchema("not-a-schema");
    expect(result.valid).toBe(false);
  });

  it("sanitizes malformed properties into schema objects", () => {
    const raw = {
      $schema: "https://www.w3.org/2001/XMLSchema",
      type: "object",
      properties: {
        title: "Some title",
        authors: [{ "@type": "string" }],
      },
    };
    const sanitized = sanitizeSchema(raw);
    expect(sanitized.schema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
    expect((sanitized.schema as any).properties.title).toMatchObject({
      type: "string",
    });
    expect((sanitized.schema as any).properties.authors).toMatchObject({
      type: "array",
    });
  });
});
