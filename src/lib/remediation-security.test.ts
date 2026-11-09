import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/api";
import { csvCell } from "@/services/analytics.service";
import { base32Encode, totpAt, matchingTotpCounter } from "@/lib/security/totp";
import { presentProfile } from "@/lib/profile-presentation";
import {
  readableBrandForeground,
  readableBrandText,
  colorContrastRatio,
} from "@/lib/public-profile";

describe("audit remediation security boundaries", () => {
  it.each([
    "=1+1",
    "+SUM(1)",
    "-1+2",
    "@SUM(1)",
    " \t=1+1",
    "\uFF1D1+1",
    "\tdata",
    "\rdata",
  ])("exports dangerous spreadsheet text as text: %s", (value) => {
    expect(csvCell(value).startsWith("\"'")).toBe(true);
  });
  it("preserves numeric cells and quotes embedded separators", () => {
    expect(csvCell(-2)).toBe("-2");
    expect(csvCell('A,"B"')).toBe('"A,""B"""');
  });
  it("rejects an oversized body even without Content-Length", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('{"value":"' + "a".repeat(128) + '"}'),
        );
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readJsonBody(request, 64)).rejects.toMatchObject({
      status: 413,
      code: "REQUEST_TOO_LARGE",
    });
  });
  it("rejects false declared body limits and malformed JSON", async () => {
    await expect(
      readJsonBody(
        new Request("http://localhost", {
          method: "POST",
          body: "{}",
          headers: { "content-length": "999" },
        }),
        64,
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readJsonBody(
        new Request("http://localhost", { method: "POST", body: "{" }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_JSON" });
  });
  // RFC 6238 Appendix B, SHA-1 test vectors; eight digits specified by the RFC vectors.
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("matches RFC 6238 SHA-1 at %i", (seconds, expected) => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totpAt(secret, Number(seconds) * 1000, 8)).toBe(expected);
  });
  it("limits authenticator verification to the documented time window", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const now = 1000000;
    expect(
      matchingTotpCounter(secret, totpAt(secret, now), now),
    ).not.toBeNull();
    expect(
      matchingTotpCounter(secret, totpAt(secret, now - 90000), now),
    ).toBeNull();
  });
  it("uses the same visibility/name mapping for preview and public presentation", () => {
    const profile = presentProfile({
      slug: "audit-profile",
      displayName: "Jane, PhD",
      honorificSuffix: "PhD",
      jobTitle: "Director",
      companyName: "Company",
      email: "jane@example.invalid",
      workPhone: "+62311234567",
      mobilePhone: "+628123456789",
      whatsappNumber: "+628123456789",
      showPhoto: false,
      showEmail: false,
      showPhone: true,
      showMobilePhone: false,
      showWorkPhone: true,
      showWhatsapp: false,
      showAddress: false,
      showSocialLinks: false,
      sectionOrder: null,
      socialLinks: [],
      company: { name: "Company", primaryColor: "#FFFFFF" },
    });
    expect(profile.formattedName).toBe("Jane, PhD");
    expect(profile.showAvatar).toBe(false);
    expect(profile.contact.email).toBeUndefined();
    expect(profile.contact.mobilePhone).toBeUndefined();
    expect(profile.contact.whatsapp).toBeUndefined();
    expect(profile.contact.workPhone).toBeDefined();
    expect(
      colorContrastRatio(readableBrandText("#FFFFFF"), "#FFFFFF"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      colorContrastRatio(readableBrandForeground("#FFFFFF"), "#FFFFFF"),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
