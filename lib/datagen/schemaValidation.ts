export function validateJsonSchema(schema: unknown) {
  const errors: Array<{ path: string; message: string }> = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    errors.push({ path: "", message: "Schema must be an object" });
    return { valid: false, errors };
  }

  const candidate = schema as Record<string, unknown>;
  const schemaUri = candidate.$schema;
  if (typeof schemaUri !== "string") {
    errors.push({ path: "/$schema", message: "Missing $schema string" });
  }

  if (candidate.type !== "object") {
    errors.push({ path: "/type", message: "Schema type must be 'object'" });
  }

  if (
    !candidate.properties ||
    typeof candidate.properties !== "object" ||
    Array.isArray(candidate.properties)
  ) {
    errors.push({ path: "/properties", message: "properties must be an object" });
  }

  if (candidate.required !== undefined && !Array.isArray(candidate.required)) {
    errors.push({ path: "/required", message: "required must be an array" });
  }

  if (candidate.additionalProperties !== undefined) {
    const ap = candidate.additionalProperties;
    if (typeof ap !== "boolean" && (typeof ap !== "object" || Array.isArray(ap))) {
      errors.push({
        path: "/additionalProperties",
        message: "additionalProperties must be boolean or schema object",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function inferTypeFromValue(value: unknown): string {
  if (value === null || value === undefined) return "string";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "string";
  }
}

function normalizePropertySchema(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    const typeValue =
      typeof candidate.type === "string"
        ? candidate.type
        : typeof candidate["@type"] === "string"
          ? candidate["@type"]
          : undefined;
    if (typeValue) {
      return { type: typeValue };
    }
  }

  if (Array.isArray(value)) {
    const itemType = value.length > 0 ? inferTypeFromValue(value[0]) : "string";
    return { type: "array", items: { type: itemType } };
  }

  return { type: inferTypeFromValue(value) };
}

export function sanitizeSchema(schema: unknown) {
  const warnings: string[] = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { schema, warnings: ["Schema is not an object; cannot sanitize."] };
  }

  const next: Record<string, unknown> = { ...(schema as Record<string, unknown>) };

  const schemaUri = typeof next.$schema === "string" ? next.$schema : "";
  if (!schemaUri.includes("json-schema.org")) {
    next.$schema = "https://json-schema.org/draft/2020-12/schema";
    warnings.push("Replaced invalid $schema with JSON Schema 2020-12 URL.");
  }

  if (next.type !== "object") {
    next.type = "object";
    warnings.push("Forced schema type to object.");
  }

  const props = next.properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    next.properties = {};
    warnings.push("Initialized missing properties object.");
  }

  const normalizedProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    (next.properties ?? {}) as Record<string, unknown>,
  )) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (typeof obj.type === "string") {
        normalizedProps[key] = obj;
        continue;
      }
    }
    normalizedProps[key] = normalizePropertySchema(value);
    warnings.push(`Normalized property schema for "${key}".`);
  }
  next.properties = normalizedProps;

  if (!Array.isArray(next.required)) {
    next.required = Object.keys(normalizedProps);
    warnings.push("Rebuilt required list from properties.");
  }

  if (next.additionalProperties === undefined) {
    next.additionalProperties = false;
    warnings.push("Set additionalProperties to false.");
  }

  return { schema: next, warnings };
}
