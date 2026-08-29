import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

describe("public product positioning", () => {
  it("presents DataGems as a live SmartClover research product", () => {
    const layout = normalize(readFileSync("app/layout.tsx", "utf8"));
    const login = normalize(readFileSync("app/(auth)/login/page.tsx", "utf8"));

    expect(layout).toContain("Live synthetic-data research product");
    expect(login).toContain(
      "Use your cstore-auth credentials to access the live DataGems workspace. DataGems is an open-source SmartClover product for schema-driven synthetic-data generation, configured jobs, monitoring, and JSON/CSV export.",
    );
    expect(layout).not.toContain("Synthetic dataset generator");
    expect(login).not.toContain("Use your cstore-auth credentials to access the DataGems dashboard.");
  });
});
