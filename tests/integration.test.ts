import { access } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { createAdmin, updateAdmin } from "@/services/admin.service";
import {
  authenticateUser,
  changePassword,
  getSessionFromRequest,
} from "@/services/auth.service";
import {
  listAccessibleCompanies,
} from "@/services/authorization.service";
import { removeCompanyAsset, uploadCompanyAsset } from "@/services/company-asset.service";
import { createCompany } from "@/services/company.service";

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

async function createRoot(mustChangePassword = false) {
  return prisma.user.create({
    data: {
      username: "root",
      name: "Root Administrator",
      email: null,
      passwordHash: await hashPassword("temporary-password-123"),
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      mustChangePassword,
    },
  });
}

describe.sequential("database integration", () => {
  beforeEach(cleanDatabase);

  it("authenticates, stores only a token hash, and resolves the session cookie", async () => {
    await createRoot();
    const bundle = await authenticateUser("ROOT", "temporary-password-123");
    const stored = await prisma.session.findUniqueOrThrow({ where: { id: bundle.session.id } });
    expect(stored.tokenHash).not.toBe(bundle.sessionToken);
    expect(stored.tokenHash).toHaveLength(64);

    const request = new NextRequest("http://localhost:3000/api/auth/session", {
      headers: { cookie: `vcard_session=${bundle.sessionToken}` },
    });
    const session = await getSessionFromRequest(request);
    expect(session?.user.username).toBe("root");
  });

  it("rotates a temporary password and revokes other sessions", async () => {
    await createRoot(true);
    const current = await authenticateUser("root", "temporary-password-123");
    const other = await authenticateUser("root", "temporary-password-123");
    await changePassword(current.session, "temporary-password-123", "a-new-secure-password-456");

    const user = await prisma.user.findUniqueOrThrow({ where: { username: "root" } });
    expect(user.mustChangePassword).toBe(false);
    await expect(verifyPassword(user.passwordHash, "a-new-secure-password-456")).resolves.toBe(true);
    const revoked = await prisma.session.findUniqueOrThrow({ where: { id: other.session.id } });
    expect(revoked.revokedAt).toBeInstanceOf(Date);
  });

  it("isolates accessible companies for regular admins", async () => {
    const root = await createRoot();
    const rootBundle = await authenticateUser("root", "temporary-password-123");
    const first = await createCompany(rootBundle.session, {
      name: "Company A",
      slug: "company-a",
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
    await createCompany(rootBundle.session, {
      name: "Company B",
      slug: "company-b",
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
    const admin = await prisma.user.create({
      data: {
        username: "admin-a",
        name: "Admin A",
        email: "admin-a@example.com",
        passwordHash: await hashPassword("admin-secure-password"),
        role: UserRole.ADMIN,
        memberships: { create: { companyId: first.id } },
      },
    });
    const companies = await listAccessibleCompanies({
      ...rootBundle.session,
      user: { ...rootBundle.session.user, id: admin.id, role: UserRole.ADMIN },
    });
    expect(companies.map((company) => company.slug)).toEqual(["company-a"]);
    expect(root.id).toBeTruthy();
  });

  it("prevents the final Super Admin from being deactivated", async () => {
    await createRoot();
    const bundle = await authenticateUser("root", "temporary-password-123");
    await expect(updateAdmin(bundle.session, bundle.session.user.id, { isActive: false })).rejects.toMatchObject({
      code: "SELF_LOCKOUT_PREVENTED",
    });
  });

  it("creates a scoped admin with a temporary password and audit entry", async () => {
    await createRoot();
    const bundle = await authenticateUser("root", "temporary-password-123");
    const company = await createCompany(bundle.session, {
      name: "Company A",
      slug: "company-a",
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
    const admin = await createAdmin(bundle.session, {
      username: "admin.one",
      name: "Admin One",
      email: "admin.one@example.com",
      password: "admin-password-123",
      role: "ADMIN",
      companyIds: [company.id],
    });
    expect(admin.mustChangePassword).toBe(true);
    expect(admin.memberships[0]?.company.id).toBe(company.id);
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_CREATED", entityId: admin.id } })).toBe(1);
  });

  it("validates and processes a real company logo", async () => {
    await createRoot();
    const bundle = await authenticateUser("root", "temporary-password-123");
    const company = await createCompany(bundle.session, {
      name: "Company A",
      slug: "company-a",
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
    const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#1E3A5F" } }).png().toBuffer();
    const result = await uploadCompanyAsset(
      bundle.session,
      company.id,
      "logo",
      new File([png], "logo.png", { type: "image/png" }),
    );
    expect(result.path).toMatch(/^\/uploads\/companies\/.+\.webp$/);
    await expect(access(path.resolve(process.cwd(), "public", result.path.replace(/^\//, "")))).resolves.toBeUndefined();
    await removeCompanyAsset(bundle.session, company.id, "logo");
  });

  it("returns a typed error for an invalid image signature", async () => {
    await createRoot();
    const bundle = await authenticateUser("root", "temporary-password-123");
    const company = await createCompany(bundle.session, {
      name: "Company A",
      slug: "company-a",
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
    await expect(
      uploadCompanyAsset(bundle.session, company.id, "logo", new File(["not-an-image"], "fake.png", { type: "image/png" })),
    ).rejects.toBeInstanceOf(AppError);
  });
});
