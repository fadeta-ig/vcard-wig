import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "../../../next.config";

describe("production security headers", () => {
  it("enables CSP, clickjacking protection, privacy policies, and HSTS", () => {
    const headers = new Map(buildSecurityHeaders(true).map((header) => [header.key, header.value]));
    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("upgrade-insecure-requests");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
  });

  it("does not emit HSTS for the development server", () => {
    const headers = buildSecurityHeaders(false);
    expect(headers.some((header) => header.key === "Strict-Transport-Security")).toBe(false);
  });
});

