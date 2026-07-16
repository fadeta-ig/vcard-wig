import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/security/crypto";
import { assertCsrf, assertSameOrigin } from "@/lib/security/request";
import type { AuthenticatedSession } from "@/services/auth.service";

const session = {
  id: "session-id",
  csrfTokenHash: hashToken("csrf-value"),
  expiresAt: new Date(Date.now() + 60_000),
  lastSeenAt: new Date(),
  user: {
    id: "user-id",
    username: "root",
    name: "Root",
    email: null,
    role: "SUPER_ADMIN",
    isActive: true,
    mustChangePassword: false,
  },
} as AuthenticatedSession;

function request(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/test", { method: "POST", headers });
}

describe("request security", () => {
  it("accepts marked same-origin requests", () => {
    expect(() =>
      assertSameOrigin(
        request({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin", "x-vcard-request": "1" }),
      ),
    ).not.toThrow();
  });

  it("rejects cross-site requests", () => {
    expect(() =>
      assertSameOrigin(
        request({ origin: "https://attacker.example", "sec-fetch-site": "cross-site", "x-vcard-request": "1" }),
      ),
    ).toThrowError(/lintas origin/i);
  });

  it("requires a CSRF token tied to the session", () => {
    expect(() =>
      assertCsrf(
        request({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin", "x-vcard-request": "1", "x-csrf-token": "csrf-value" }),
        session,
      ),
    ).not.toThrow();
    expect(() =>
      assertCsrf(
        request({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin", "x-vcard-request": "1", "x-csrf-token": "wrong" }),
        session,
      ),
    ).toThrowError(/Token keamanan/i);
  });
});
