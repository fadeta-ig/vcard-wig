import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import jsQR from "jsqr";
import sharp from "sharp";
import { ProfileStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/password";
import { authenticateUser } from "@/services/auth.service";
import {
  clearQrCacheForTests,
  generateProfileQr,
  qrCacheSizeForTests,
} from "@/services/qr.service";
import { getAdminVCard, getDirectVCard, getPublicVCard } from "@/services/vcard.service";

const generatedDirectories: string[] = [];
sharp.cache(false);

async function removeDirectoryWithRetry(directory: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  throw lastError;
}

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

async function fixture() {
  const user = await prisma.user.create({
    data: {
      username: "phase5-root",
      name: "Phase 5 Administrator",
      passwordHash: await hashPassword("temporary-password-123"),
      role: UserRole.SUPER_ADMIN,
    },
  });
  const company = await prisma.company.create({
    data: {
      name: "Phase 5 Company",
      slug: "phase-5-company",
      primaryColor: "#1E3A5F",
      defaultQrForeground: "#111827",
      defaultQrBackground: "#FFFFFF",
      qrLogoEnabled: true,
    },
  });
  const companyDirectory = path.resolve(process.cwd(), "public", "uploads", "companies", company.id);
  const profileDirectory = path.resolve(process.cwd(), "public", "uploads", "profiles", company.id);
  generatedDirectories.push(companyDirectory, profileDirectory);
  await mkdir(companyDirectory, { recursive: true });
  await mkdir(profileDirectory, { recursive: true });
  const logoPath = path.join(companyDirectory, "logo-test.webp");
  const photoPath = path.join(profileDirectory, "thumbnail-test.webp");
  await sharp({ create: { width: 180, height: 80, channels: 4, background: "#1E3A5F" } })
    .webp()
    .toFile(logoPath);
  await sharp({ create: { width: 160, height: 160, channels: 4, background: "#B54708" } })
    .webp()
    .toFile(photoPath);
  await prisma.company.update({
    where: { id: company.id },
    data: { companyLogo: `/uploads/companies/${company.id}/logo-test.webp` },
  });
  const profile = await prisma.contactProfile.create({
    data: {
      companyId: company.id,
      createdById: user.id,
      slug: "phase5-contact",
      firstName: "Ayu",
      lastName: "Lestari",
      displayName: "Ayu Lestari",
      honorificPrefix: "Dr.",
      jobTitle: "Quality Director",
      department: "Quality Assurance",
      companyName: "Phase 5 Company",
      email: "hidden@example.com",
      workPhone: "+62315550101",
      mobilePhone: "+6281234567890",
      whatsappNumber: "+6281234567890",
      website: "https://example.com",
      addressLine1: "Jalan QR 5",
      city: "Surabaya",
      province: "Jawa Timur",
      postalCode: "60200",
      country: "Indonesia",
      shortBio: "Phase 5 contact",
      profileThumbnail: `/uploads/profiles/${company.id}/thumbnail-test.webp`,
      status: ProfileStatus.ACTIVE,
      showPhoto: true,
      showEmail: false,
      showPhone: true,
      showAddress: true,
      showSocialLinks: true,
      socialLinks: {
        create: [
          {
            platform: "LINKEDIN",
            label: "LinkedIn",
            url: "https://linkedin.com/in/ayu",
            isActive: true,
            sortOrder: 0,
          },
          {
            platform: "INSTAGRAM",
            label: "Instagram",
            url: "https://instagram.com/private-ayu",
            isActive: false,
            sortOrder: 1,
          },
        ],
      },
    },
  });
  const session = (await authenticateUser("phase5-root", "temporary-password-123")).session;
  return { company, profile, session };
}

async function decodedQr(body: Buffer | string): Promise<string | undefined> {
  const input = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  const { data, info } = await sharp(input, { density: 512 })
    .resize(1024, 1024, { fit: "fill", kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data;
}

describe.sequential("phase 5 QR and vCard integration", () => {
  beforeEach(async () => {
    clearQrCacheForTests();
    await cleanDatabase();
  });

  afterEach(async () => {
    for (const directory of generatedDirectories.splice(0)) {
      await removeDirectoryWithRetry(directory);
    }
  });

  it("round-trips dynamic PNG QR at every supported error-correction level", async () => {
    const { profile, session } = await fixture();
    for (const errorCorrection of ["L", "M", "Q", "H"] as const) {
      const qr = await generateProfileQr(session, profile.id, {
        type: "dynamic",
        format: "png",
        size: "512",
        margin: "4",
        errorCorrection,
        foreground: "#111827",
        background: "#FFFFFF",
        logo: "false",
      });
      expect(await decodedQr(qr.body)).toBe("http://localhost:3000/c/phase5-contact");
      expect(qr.options.errorCorrection).toBe(errorCorrection);
      expect(qr.fileName).toBe("qr-phase5-contact.png");
    }
  });

  it("round-trips PNG and SVG with a logo and forces H correction", async () => {
    const { profile, session } = await fixture();
    for (const format of ["png", "svg"] as const) {
      const qr = await generateProfileQr(session, profile.id, {
        type: "dynamic",
        format,
        size: "512",
        margin: "4",
        errorCorrection: "L",
        foreground: "#111827",
        background: "#FFFFFF",
        logo: "true",
      });
      expect(qr.options.errorCorrection).toBe("H");
      expect(await decodedQr(qr.body)).toBe("http://localhost:3000/c/phase5-contact");
      if (format === "svg") {
        expect(qr.body).toEqual(expect.any(String));
        expect(qr.body).toContain("data:image/png;base64,");
        expect(qr.body).not.toMatch(/<script|javascript:/i);
      }
    }
  });

  it("uses visibility-filtered vCard data and omits photos from direct QR", async () => {
    const { profile, session } = await fixture();
    const download = await getAdminVCard(session, profile.id);
    const direct = await getDirectVCard(session, profile.id);
    expect(download.content).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
    expect(direct.content).not.toContain("PHOTO;");
    expect(direct.content).not.toContain("hidden@example.com");
    expect(direct.content).not.toContain("private-ayu");
    expect(direct.content).toContain("TEL;TYPE=CELL:+6281234567890");
    expect(direct.content).toContain("item1.X-ABLabel:LinkedIn");

    const qr = await generateProfileQr(session, profile.id, {
      type: "vcard",
      format: "png",
      size: "1024",
      margin: "4",
      errorCorrection: "M",
      foreground: "#111827",
      background: "#FFFFFF",
      logo: "false",
    });
    const decoded = await decodedQr(qr.body);
    expect(decoded).toBe(direct.content);
    expect(decoded).toContain("BEGIN:VCARD\r\nVERSION:3.0");
    expect(qr.fileName).toBe("qr-vcard-phase5-contact.png");
  });

  it("keeps dynamic QR stable while invalidating direct-vCard cache after profile updates", async () => {
    const { profile, session } = await fixture();
    const options = {
      format: "png",
      size: "512",
      margin: "4",
      errorCorrection: "M",
      foreground: "#111827",
      background: "#FFFFFF",
      logo: "false",
    };
    const dynamicBefore = await generateProfileQr(session, profile.id, { ...options, type: "dynamic" });
    const directBefore = await generateProfileQr(session, profile.id, { ...options, type: "vcard" });
    expect(qrCacheSizeForTests()).toBe(2);

    await prisma.contactProfile.update({
      where: { id: profile.id },
      data: { jobTitle: "Updated Quality Director" },
    });
    const dynamicAfter = await generateProfileQr(session, profile.id, { ...options, type: "dynamic" });
    const directAfter = await generateProfileQr(session, profile.id, { ...options, type: "vcard" });
    expect(dynamicAfter.fingerprint).toBe(dynamicBefore.fingerprint);
    expect(dynamicAfter.cacheHit).toBe(true);
    expect(directAfter.fingerprint).not.toBe(directBefore.fingerprint);
    expect(directAfter.payload).toContain("TITLE:Updated Quality Director");
    expect(qrCacheSizeForTests()).toBe(3);
  });

  it("serves public vCard only for active profiles and preserves visibility", async () => {
    const { profile } = await fixture();
    const active = await getPublicVCard(profile.slug);
    expect(active.content).toContain("FN:Ayu Lestari");
    expect(active.content).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
    expect(active.content).not.toContain("hidden@example.com");

    await prisma.contactProfile.update({
      where: { id: profile.id },
      data: { status: ProfileStatus.INACTIVE },
    });
    await expect(getPublicVCard(profile.slug)).rejects.toMatchObject({
      code: "PROFILE_NOT_FOUND",
      status: 404,
    });
  });
});
