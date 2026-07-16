import { describe, expect, it } from "vitest";
import { createOpaqueToken, hashToken, safeTokenMatches } from "@/lib/security/crypto";

describe("security crypto", () => {
  it("creates unpredictable URL-safe tokens", () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it("compares tokens against hashes without accepting a different token", () => {
    const token = createOpaqueToken();
    const hash = hashToken(token);
    expect(hash).toHaveLength(64);
    expect(safeTokenMatches(token, hash)).toBe(true);
    expect(safeTokenMatches(`${token}x`, hash)).toBe(false);
  });
});
