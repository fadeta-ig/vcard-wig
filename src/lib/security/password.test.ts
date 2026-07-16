import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/security/password";

describe("password hashing", () => {
  it("uses Argon2id and verifies only the correct password", async () => {
    const hash = await hashPassword("a-secure-test-password");
    expect(hash).toContain("$argon2id$");
    await expect(verifyPassword(hash, "a-secure-test-password")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });
});
