import { describe, expect, it } from "vitest";

import { validateExternalBaseUrl } from "@/lib/security/urlValidation";

describe("validateExternalBaseUrl", () => {
  it("accepts public https hosts", () => {
    expect(validateExternalBaseUrl("https://api.openai.com").ok).toBe(true);
    expect(validateExternalBaseUrl("http://example.com:8080/v1").ok).toBe(true);
  });

  it("rejects localhost and local domains", () => {
    expect(validateExternalBaseUrl("http://localhost:1234").ok).toBe(false);
    expect(validateExternalBaseUrl("http://service.local").ok).toBe(false);
    expect(validateExternalBaseUrl("http://db.internal").ok).toBe(false);
  });

  it("rejects private and loopback IPs", () => {
    expect(validateExternalBaseUrl("http://127.0.0.1:8080").ok).toBe(false);
    expect(validateExternalBaseUrl("http://10.0.0.5").ok).toBe(false);
    expect(validateExternalBaseUrl("http://192.168.1.10").ok).toBe(false);
    expect(validateExternalBaseUrl("http://172.20.0.1").ok).toBe(false);
    expect(validateExternalBaseUrl("http://169.254.1.2").ok).toBe(false);
    expect(validateExternalBaseUrl("http://[::1]:8080").ok).toBe(false);
    expect(validateExternalBaseUrl("http://[fd00::1]:8080").ok).toBe(false);
    expect(validateExternalBaseUrl("http://[fe80::1]:8080").ok).toBe(false);
  });

  it("rejects unsupported protocols and embedded credentials", () => {
    expect(validateExternalBaseUrl("file:///tmp/x").ok).toBe(false);
    expect(validateExternalBaseUrl("http://user:pass@example.com").ok).toBe(false);
  });
});
