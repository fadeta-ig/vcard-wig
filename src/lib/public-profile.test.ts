import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  emailAction,
  formatPublicDisplayName,
  isPublicSlug,
  publicProfileUrl,
  readableBrandForeground,
  safeBrandColor,
  safeHttpUrl,
  safePublicAsset,
  telephoneAction,
  whatsappAction,
} from "@/lib/public-profile";

describe("public profile safety helpers", () => {
  it("formats honorific prefixes and suffixes without duplicating existing titles", () => {
    expect(formatPublicDisplayName("Feri Edy Purnomo", "Ir.", "S.T., M.M.")).toBe(
      "Ir. Feri Edy Purnomo, S.T., M.M.",
    );
    expect(formatPublicDisplayName("Dr. Jane Doe, Ph.D.", "Dr.", "Ph.D.")).toBe(
      "Dr. Jane Doe, Ph.D.",
    );
    expect(formatPublicDisplayName("  Jane   Doe  ", "", ", M.B.A.")).toBe(
      "Jane Doe, M.B.A.",
    );
  });

  it("only permits credential-free HTTP(S) URLs", () => {
    expect(safeHttpUrl("https://example.com/profile?q=1")).toBe("https://example.com/profile?q=1");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:text/html,test")).toBeUndefined();
    expect(safeHttpUrl("https://user:password@example.com")).toBeUndefined();
    expect(safeHttpUrl("not a URL")).toBeUndefined();
  });

  it("builds constrained phone, WhatsApp, and email actions", () => {
    expect(telephoneAction("+628123456789")).toEqual({
      value: "+628123456789",
      href: "tel:+628123456789",
    });
    expect(whatsappAction("+628123456789")).toEqual({
      value: "+628123456789",
      href: "https://wa.me/628123456789",
    });
    expect(telephoneAction("08123456789")).toBeUndefined();
    expect(whatsappAction("+62 812")).toBeUndefined();
    expect(emailAction("jane@example.com")).toEqual({
      value: "jane@example.com",
      href: "mailto:jane@example.com",
    });
    expect(emailAction("jane@example.com?subject=Injected")).toBeUndefined();
    expect(emailAction("jane@example.com\r\nBcc:test@example.com")).toBeUndefined();
  });

  it("constrains local assets, slugs, canonical URLs, and brand contrast", () => {
    expect(safePublicAsset("/uploads/profiles/id/photo.webp", "profiles")).toBe(
      "/uploads/profiles/id/photo.webp",
    );
    expect(safePublicAsset("/uploads/profiles/../secret.txt", "profiles")).toBeUndefined();
    expect(safePublicAsset("https://example.com/photo.webp", "profiles")).toBeUndefined();
    expect(isPublicSlug("jane-doe-2")).toBe(true);
    expect(isPublicSlug("Jane Doe")).toBe(false);
    expect(absoluteUrl("https://vcard.example.com", "privacy")).toBe(
      "https://vcard.example.com/privacy",
    );
    expect(publicProfileUrl("https://vcard.example.com/", "jane-doe")).toBe(
      "https://vcard.example.com/c/jane-doe",
    );
    expect(safeBrandColor("#ffffff")).toBe("#FFFFFF");
    expect(safeBrandColor("invalid")).toBe("#1E3A5F");
    expect(readableBrandForeground("#FFFFFF")).toBe("#1A1D21");
    expect(readableBrandForeground("#000000")).toBe("#FFFFFF");
  });
});
