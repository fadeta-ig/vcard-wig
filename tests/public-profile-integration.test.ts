import { beforeEach, describe, expect, it } from "vitest";
import { ProfileStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/password";
import { getPublicProfileBySlug } from "@/services/public-profile.service";

async function cleanDatabase() {
  await prisma.publicRateLimit.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.socialLink.deleteMany();
  await prisma.contactProfile.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loginThrottle.deleteMany();
  await prisma.userCompanyMembership.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
}

async function createFixture(
  slug: string,
  overrides: {
    status?: ProfileStatus;
    companyActive?: boolean;
    primaryColor?: string;
    showPhoto?: boolean;
    showEmail?: boolean;
    showPhone?: boolean;
    showAddress?: boolean;
    showSocialLinks?: boolean;
  } = {},
) {
  const user = await prisma.user.create({
    data: {
      username: `root-${slug}`,
      name: "Test Administrator",
      passwordHash: await hashPassword("temporary-password-123"),
      role: UserRole.SUPER_ADMIN,
    },
  });
  const company = await prisma.company.create({
    data: {
      name: `Company ${slug}`,
      slug: `company-${slug}`,
      primaryColor: overrides.primaryColor ?? "#1E3A5F",
      isActive: overrides.companyActive ?? true,
    },
  });
  const profile = await prisma.contactProfile.create({
    data: {
      companyId: company.id,
      createdById: user.id,
      slug,
      firstName: "Jane",
      lastName: "Doe",
      displayName: "Jane Secret Doe",
      jobTitle: "Operations Director",
      department: "Operations",
      companyName: company.name,
      email: "hidden@example.com",
      workPhone: "+62315550101",
      mobilePhone: "+6281234567890",
      whatsappNumber: "+6281234567890",
      website: "https://example.com/contact",
      addressLine1: "Jalan Rahasia 1",
      city: "Surabaya",
      province: "Jawa Timur",
      postalCode: "60200",
      country: "Indonesia",
      shortBio: "Professional biography",
      profilePhoto: `/uploads/profiles/${slug}/profile.webp`,
      status: overrides.status ?? ProfileStatus.ACTIVE,
      showPhoto: overrides.showPhoto ?? true,
      showEmail: overrides.showEmail ?? true,
      showPhone: overrides.showPhone ?? true,
      showAddress: overrides.showAddress ?? true,
      showSocialLinks: overrides.showSocialLinks ?? true,
      sectionOrder: ["BIO", "CONTACT", "SOCIAL", "ADDRESS"],
      socialLinks: {
        create: [
          {
            platform: "LINKEDIN",
            label: "LinkedIn",
            username: "jane-doe",
            url: "https://www.linkedin.com/in/jane-doe",
            sortOrder: 0,
            isActive: true,
          },
          {
            platform: "INSTAGRAM",
            label: "Instagram",
            username: "private-jane",
            url: "https://www.instagram.com/private-jane",
            sortOrder: 1,
            isActive: false,
          },
        ],
      },
    },
  });
  return { company, profile };
}

describe.sequential("public profile phase 4 integration", () => {
  beforeEach(cleanDatabase);

  it("does not expose Draft or Archived profiles and gives Inactive a PII-free response", async () => {
    const { profile } = await createFixture("private-profile", { status: ProfileStatus.DRAFT });
    expect(await getPublicProfileBySlug(profile.slug)).toEqual({ kind: "not_found" });

    await prisma.contactProfile.update({
      where: { id: profile.id },
      data: { status: ProfileStatus.INACTIVE },
    });
    const inactive = await getPublicProfileBySlug(profile.slug);
    expect(inactive.kind).toBe("inactive");
    expect(JSON.stringify(inactive)).not.toContain("Jane Secret Doe");
    expect(JSON.stringify(inactive)).not.toContain("hidden@example.com");
    expect(JSON.stringify(inactive)).not.toContain("Operations Director");

    await prisma.contactProfile.update({
      where: { id: profile.id },
      data: { status: ProfileStatus.ARCHIVED },
    });
    expect(await getPublicProfileBySlug(profile.slug)).toEqual({ kind: "not_found" });
  });

  it("removes every hidden field from the server DTO instead of only hiding it with CSS", async () => {
    const { profile } = await createFixture("hidden-fields", {
      showPhoto: false,
      showEmail: false,
      showPhone: false,
      showAddress: false,
      showSocialLinks: false,
    });
    const result = await getPublicProfileBySlug(profile.slug);
    expect(result.kind).toBe("active");
    if (result.kind !== "active") throw new Error("Expected active profile");

    expect(result.profile).not.toHaveProperty("photoUrl");
    expect(result.profile).not.toHaveProperty("address");
    expect(result.profile).not.toHaveProperty("socialLinks");
    expect(result.profile.contact).not.toHaveProperty("email");
    expect(result.profile.contact).not.toHaveProperty("workPhone");
    expect(result.profile.contact).not.toHaveProperty("mobilePhone");
    expect(result.profile.contact).not.toHaveProperty("whatsapp");
    expect(result.profile.contact.website).toEqual({
      value: "https://example.com/contact",
      href: "https://example.com/contact",
    });
    expect(JSON.stringify(result)).not.toContain("hidden@example.com");
    expect(JSON.stringify(result)).not.toContain("Jalan Rahasia");
    expect(JSON.stringify(result)).not.toContain("private-jane");
  });

  it("preserves section order and emits only active, safe social links", async () => {
    const { profile } = await createFixture("visible-profile");
    await prisma.socialLink.create({
      data: {
        contactProfileId: profile.id,
        platform: "CUSTOM",
        label: "Unsafe",
        url: "javascript:alert(1)",
        sortOrder: 2,
        isActive: true,
      },
    });
    const result = await getPublicProfileBySlug(profile.slug);
    expect(result.kind).toBe("active");
    if (result.kind !== "active") throw new Error("Expected active profile");
    expect(result.profile.sectionOrder).toEqual(["BIO", "CONTACT", "SOCIAL", "ADDRESS"]);
    expect(result.profile.socialLinks).toEqual([
      {
        trackingId: expect.any(String),
        platform: "LINKEDIN",
        label: "LinkedIn",
        username: "jane-doe",
        href: "https://www.linkedin.com/in/jane-doe",
      },
    ]);
    expect(result.profile.contact.whatsapp?.href).toBe("https://wa.me/6281234567890");
    expect(result.profile.contact.email?.href).toBe("mailto:hidden@example.com");
  });

  it("keeps company branding isolated and hides profiles belonging to inactive companies", async () => {
    const first = await createFixture("company-one-profile", { primaryColor: "#112233" });
    const second = await createFixture("company-two-profile", { primaryColor: "#AABBCC" });
    const firstResult = await getPublicProfileBySlug(first.profile.slug);
    const secondResult = await getPublicProfileBySlug(second.profile.slug);
    expect(firstResult.kind === "active" && firstResult.profile.brand.primaryColor).toBe("#112233");
    expect(secondResult.kind === "active" && secondResult.profile.brand.primaryColor).toBe("#AABBCC");

    await prisma.company.update({ where: { id: first.company.id }, data: { isActive: false } });
    expect(await getPublicProfileBySlug(first.profile.slug)).toEqual({ kind: "not_found" });
    expect((await getPublicProfileBySlug(second.profile.slug)).kind).toBe("active");
  });

  it("rejects malformed slugs without returning profile data", async () => {
    await createFixture("valid-profile");
    expect(await getPublicProfileBySlug("../valid-profile")).toEqual({ kind: "not_found" });
    expect(await getPublicProfileBySlug("VALID-PROFILE")).toEqual({ kind: "not_found" });
  });
});
