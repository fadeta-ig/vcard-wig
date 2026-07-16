import { describe, expect, it } from "vitest";
import {
  adminCreateSchema,
  companyCreateSchema,
  loginSchema,
  profileCreateSchema,
  profileUpdateSchema,
  socialLinkCreateSchema,
} from "@/lib/validation";

const validCompany = {
  name: "Wijaya Inovasi",
  slug: "wijaya-inovasi",
  legalName: "",
  website: "https://wijayainovasi.co.id",
  email: "INFO@WIJAYAINOVASI.CO.ID",
  phone: "+62 21 555 0101",
  address: "Jakarta",
  primaryColor: "#1e3a5f",
  secondaryColor: "",
  qrLogoEnabled: false,
  defaultQrForeground: "#111827",
  defaultQrBackground: "#ffffff",
  isActive: true,
};

describe("validation", () => {
  it("normalizes company fields and limits colors to hex", () => {
    const parsed = companyCreateSchema.parse(validCompany);
    expect(parsed.email).toBe("info@wijayainovasi.co.id");
    expect(parsed.primaryColor).toBe("#1E3A5F");
    expect(parsed.defaultQrBackground).toBe("#FFFFFF");
    expect(parsed.legalName).toBeNull();
  });

  it("rejects unsafe URL protocols", () => {
    expect(() => companyCreateSchema.parse({ ...validCompany, website: "javascript:alert(1)" })).toThrow();
  });

  it("requires company assignment for regular admins", () => {
    const base = {
      username: "admin.one",
      name: "Admin One",
      email: "admin@example.com",
      password: "test-password-123",
      role: "ADMIN" as const,
      companyIds: [],
    };
    expect(() => adminCreateSchema.parse(base)).toThrow();
    expect(adminCreateSchema.parse({ ...base, role: "SUPER_ADMIN" })).toBeTruthy();
  });

  it("normalizes login identifiers", () => {
    expect(loginSchema.parse({ identifier: " ROOT ", password: "secret" }).identifier).toBe("root");
  });

  it("normalizes international profile phones and email", () => {
    const parsed = profileCreateSchema.parse({
      slug: "jane-doe",
      firstName: "Jane",
      lastName: "Doe",
      displayName: "",
      honorificPrefix: "",
      honorificSuffix: "",
      jobTitle: "Director",
      department: "Operations",
      companyName: "Wijaya Inovasi",
      email: " JANE@EXAMPLE.COM ",
      workPhone: "+62 (31) 555-0101",
      mobilePhone: "0062 812-3456-7890",
      whatsappNumber: "",
      website: "https://example.com",
      addressLine1: "",
      addressLine2: "",
      city: "",
      province: "",
      postalCode: "",
      country: "Indonesia",
      shortBio: "",
      showPhoto: true,
      showEmail: true,
      showPhone: true,
      showAddress: true,
      showSocialLinks: true,
      sectionOrder: ["CONTACT", "SOCIAL", "ADDRESS", "BIO"],
      socialLinks: [],
    });
    expect(parsed.email).toBe("jane@example.com");
    expect(parsed.workPhone).toBe("+62315550101");
    expect(parsed.mobilePhone).toBe("+6281234567890");
    expect(parsed.whatsappNumber).toBeNull();
  });

  it("rejects reserved profile slugs, invalid section order, and unsafe social URLs", () => {
    const base = {
      firstName: "Jane",
      jobTitle: "Director",
      companyName: "Wijaya Inovasi",
      email: "jane@example.com",
    };
    expect(() => profileCreateSchema.parse({ ...base, slug: "admin" })).toThrow();
    expect(() => profileCreateSchema.parse({
      ...base,
      sectionOrder: ["CONTACT", "CONTACT", "ADDRESS", "BIO"],
    })).toThrow();
    expect(() => socialLinkCreateSchema.parse({
      platform: "CUSTOM",
      label: "Portfolio",
      username: "",
      url: "javascript:alert(1)",
      isActive: true,
    })).toThrow();
  });

  it("requires a label for custom links and keeps partial updates partial", () => {
    expect(() => socialLinkCreateSchema.parse({
      platform: "CUSTOM",
      label: "",
      username: "",
      url: "https://example.com",
      isActive: true,
    })).toThrow();
    expect(profileUpdateSchema.parse({ jobTitle: "Managing Director" })).toEqual({
      jobTitle: "Managing Director",
    });
  });
});
