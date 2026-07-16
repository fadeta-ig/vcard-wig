import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { ProfileStatus, UserRole } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/password";
import { profileCreateSchema, profileListQuerySchema, profileUpdateSchema } from "@/lib/validation";
import { authenticateUser } from "@/services/auth.service";
import { createCompany } from "@/services/company.service";
import { removeProfilePhoto, uploadProfilePhoto } from "@/services/profile-photo.service";
import {
  changeProfileStatus,
  createProfile,
  getProfileForSession,
  listProfiles,
  updateProfile,
} from "@/services/profile.service";

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

async function rootSession() {
  await prisma.user.create({
    data: {
      username: "root",
      name: "Root Administrator",
      passwordHash: await hashPassword("temporary-password-123"),
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  return (await authenticateUser("root", "temporary-password-123")).session;
}

async function companyFor(session: Awaited<ReturnType<typeof rootSession>>, slug: string) {
  return createCompany(session, {
    name: slug === "company-a" ? "Company A" : "Company B",
    slug,
    legalName: null,
    website: null,
    email: null,
    phone: null,
    address: null,
    primaryColor: "#1E3A5F",
    secondaryColor: null,
    qrLogoEnabled: false,
    defaultQrForeground: "#111827",
    defaultQrBackground: "#FFFFFF",
    isActive: true,
  });
}

function profileInput(overrides: Record<string, unknown> = {}) {
  return profileCreateSchema.parse({
    slug: "",
    firstName: "Jane",
    lastName: "Doe",
    displayName: "Jane Doe",
    honorificPrefix: "",
    honorificSuffix: "",
    jobTitle: "Operations Director",
    department: "Operations",
    companyName: "Company A",
    email: "jane@example.com",
    workPhone: "+62315550101",
    mobilePhone: "+6281234567890",
    whatsappNumber: "+6281234567890",
    website: "https://example.com",
    addressLine1: "Jalan Contoh 1",
    addressLine2: "",
    city: "Surabaya",
    province: "Jawa Timur",
    postalCode: "60200",
    country: "Indonesia",
    shortBio: "Corporate contact profile",
    showPhoto: true,
    showEmail: true,
    showPhone: true,
    showAddress: true,
    showSocialLinks: true,
    sectionOrder: ["CONTACT", "SOCIAL", "ADDRESS", "BIO"],
    socialLinks: [
      {
        platform: "LINKEDIN",
        label: "LinkedIn",
        username: "jane-doe",
        url: "https://www.linkedin.com/in/jane-doe",
        isActive: true,
      },
      {
        platform: "INSTAGRAM",
        label: "Instagram",
        username: "jane",
        url: "https://www.instagram.com/jane",
        isActive: false,
      },
    ],
    ...overrides,
  });
}

function listInput(overrides: Record<string, unknown> = {}) {
  return profileListQuerySchema.parse({ page: 1, pageSize: 10, ...overrides });
}

function diskPath(publicPath: string): string {
  return path.resolve(process.cwd(), "public", publicPath.replace(/^\//, ""));
}

describe.sequential("profile phase 3 integration", () => {
  beforeEach(cleanDatabase);

  it("creates profiles transactionally, assigns collision-safe slugs, and preserves social order", async () => {
    const session = await rootSession();
    const company = await companyFor(session, "company-a");
    const first = await createProfile(session, company.id, profileInput());
    const second = await createProfile(session, company.id, profileInput({ email: "jane@example.com" }));

    expect(first.slug).toBe("jane-doe");
    expect(second.slug).toBe("jane-doe-2");
    expect(first.socialLinks.map((link) => [link.platform, link.sortOrder, link.icon])).toEqual([
      ["LINKEDIN", 0, "linkedin"],
      ["INSTAGRAM", 1, "instagram"],
    ]);
    expect(await prisma.auditLog.count({ where: { action: "PROFILE_CREATED" } })).toBe(2);

    const result = await listProfiles(session, company.id, listInput());
    expect(result.items).toHaveLength(2);
    expect(result.summary.draft).toBe(2);
  });

  it("enforces company isolation for regular administrators", async () => {
    const root = await rootSession();
    const companyA = await companyFor(root, "company-a");
    const companyB = await companyFor(root, "company-b");
    const profileB = await createProfile(root, companyB.id, profileInput({ companyName: "Company B" }));
    await prisma.user.create({
      data: {
        username: "admin-a",
        name: "Admin A",
        email: "admin-a@example.com",
        passwordHash: await hashPassword("admin-password-123"),
        role: UserRole.ADMIN,
        memberships: { create: { companyId: companyA.id } },
      },
    });
    const admin = (await authenticateUser("admin-a", "admin-password-123")).session;

    await expect(getProfileForSession(admin, profileB.id)).rejects.toMatchObject({
      code: "COMPANY_NOT_FOUND",
    });
    await expect(listProfiles(admin, companyB.id, listInput())).rejects.toMatchObject({
      code: "COMPANY_NOT_FOUND",
    });
    await expect(updateProfile(admin, profileB.id, profileUpdateSchema.parse({ jobTitle: "Tampered" }))).rejects.toMatchObject({
      code: "COMPANY_NOT_FOUND",
    });
  });

  it("updates profile and social links atomically and applies lifecycle rules", async () => {
    const session = await rootSession();
    const company = await companyFor(session, "company-a");
    const profile = await createProfile(session, company.id, profileInput());
    const updated = await updateProfile(
      session,
      profile.id,
      profileUpdateSchema.parse({
        jobTitle: "Managing Director",
        showEmail: false,
        sectionOrder: ["BIO", "CONTACT", "ADDRESS", "SOCIAL"],
        socialLinks: [
          {
            platform: "GITHUB",
            label: "GitHub",
            username: "jane",
            url: "https://github.com/jane",
            isActive: true,
          },
        ],
      }),
    );
    expect(updated.jobTitle).toBe("Managing Director");
    expect(updated.showEmail).toBe(false);
    expect(updated.sectionOrder).toEqual(["BIO", "CONTACT", "ADDRESS", "SOCIAL"]);
    expect(updated.socialLinks.map((link) => [link.platform, link.sortOrder])).toEqual([["GITHUB", 0]]);

    const active = await changeProfileStatus(session, profile.id, ProfileStatus.ACTIVE);
    expect(active.publishedAt).toBeInstanceOf(Date);
    const firstPublishedAt = active.publishedAt?.getTime();
    await expect(
      updateProfile(session, profile.id, profileUpdateSchema.parse({ slug: "changed-after-publish" })),
    ).rejects.toMatchObject({ code: "PROFILE_SLUG_LOCKED" });
    await expect(changeProfileStatus(session, profile.id, ProfileStatus.DRAFT)).rejects.toMatchObject({
      code: "PROFILE_STATUS_TRANSITION_INVALID",
    });
    await changeProfileStatus(session, profile.id, ProfileStatus.INACTIVE);
    const reactivated = await changeProfileStatus(session, profile.id, ProfileStatus.ACTIVE);
    expect(reactivated.publishedAt?.getTime()).toBe(firstPublishedAt);
    await changeProfileStatus(session, profile.id, ProfileStatus.ARCHIVED);
    expect((await listProfiles(session, company.id, listInput())).items).toHaveLength(0);
    expect((await listProfiles(session, company.id, listInput({ status: "ARCHIVED" }))).items).toHaveLength(1);
    const restored = await changeProfileStatus(session, profile.id, ProfileStatus.DRAFT);
    expect(restored.publishedAt).toBeNull();
  });

  it("searches and filters only within the selected company", async () => {
    const session = await rootSession();
    const companyA = await companyFor(session, "company-a");
    const companyB = await companyFor(session, "company-b");
    await createProfile(session, companyA.id, profileInput({ firstName: "Jane", displayName: "Jane Doe", department: "Operations" }));
    await createProfile(session, companyA.id, profileInput({ firstName: "John", displayName: "John Smith", email: "john@example.com", department: "Sales" }));
    await createProfile(session, companyB.id, profileInput({ firstName: "Hidden", displayName: "Hidden Tenant", email: "hidden@example.com", companyName: "Company B" }));

    const search = await listProfiles(session, companyA.id, listInput({ search: "john" }));
    expect(search.items.map((item) => item.displayName)).toEqual(["John Smith"]);
    const department = await listProfiles(session, companyA.id, listInput({ department: "Operations" }));
    expect(department.items.map((item) => item.displayName)).toEqual(["Jane Doe"]);
    expect(search.filters.departments).toEqual(["Operations", "Sales"]);
  });

  it("processes profile photos, removes replaced files, and rejects invalid content", async () => {
    const session = await rootSession();
    const company = await companyFor(session, "company-a");
    const profile = await createProfile(session, company.id, profileInput());
    const firstPng = await sharp({ create: { width: 120, height: 80, channels: 4, background: "#1E3A5F" } }).png().toBuffer();
    const first = await uploadProfilePhoto(
      session,
      profile.id,
      new File([firstPng], "profile.png", { type: "image/png" }),
    );
    expect(await sharp(await readFile(diskPath(first.profilePhoto))).metadata()).toMatchObject({ format: "webp", width: 600, height: 600 });
    expect(await sharp(await readFile(diskPath(first.profileThumbnail))).metadata()).toMatchObject({ format: "webp", width: 160, height: 160 });

    const replacementPng = await sharp({ create: { width: 100, height: 100, channels: 4, background: "#16803C" } }).png().toBuffer();
    const replacement = await uploadProfilePhoto(
      session,
      profile.id,
      new File([replacementPng], "replacement.png", { type: "image/png" }),
    );
    await expect(access(diskPath(first.profilePhoto))).rejects.toThrow();
    await expect(access(diskPath(first.profileThumbnail))).rejects.toThrow();

    await expect(
      uploadProfilePhoto(session, profile.id, new File(["not-an-image"], "fake.png", { type: "image/png" })),
    ).rejects.toBeInstanceOf(AppError);
    const tooWide = await sharp({ create: { width: 2001, height: 10, channels: 3, background: "white" } }).png().toBuffer();
    await expect(
      uploadProfilePhoto(session, profile.id, new File([tooWide], "wide.png", { type: "image/png" })),
    ).rejects.toMatchObject({ code: "IMAGE_DIMENSIONS_INVALID" });

    await removeProfilePhoto(session, profile.id);
    await expect(access(diskPath(replacement.profilePhoto))).rejects.toThrow();
    await expect(access(diskPath(replacement.profileThumbnail))).rejects.toThrow();
  });
});
