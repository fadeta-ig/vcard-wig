import path from "node:path";
import sharp from "sharp";
import { Prisma, ProfileStatus } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { safeHttpUrl, safePublicAsset } from "@/lib/public-profile";
import { prisma } from "@/lib/prisma";
import { generateVCard, type VCardSource } from "@/lib/vcard";
import type { AuthenticatedSession } from "@/services/auth.service";
import { getProfileForSession } from "@/services/profile.service";

type VCardProfile = {
  firstName: string;
  lastName: string | null;
  displayName: string;
  honorificPrefix: string | null;
  honorificSuffix: string | null;
  companyName: string;
  jobTitle: string;
  department: string | null;
  workPhone: string | null;
  mobilePhone: string | null;
  whatsappNumber: string | null;
  email: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  website: string | null;
  shortBio: string | null;
  profilePhoto: string | null;
  profileThumbnail: string | null;
  showPhoto: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showSocialLinks: boolean;
  socialLinks: {
    platform: string;
    label: string | null;
    url: string;
    isActive: boolean;
    sortOrder: number;
  }[];
};

const publicVCardSelect = {
  id: true,
  slug: true,
  firstName: true,
  lastName: true,
  displayName: true,
  honorificPrefix: true,
  honorificSuffix: true,
  companyName: true,
  jobTitle: true,
  department: true,
  workPhone: true,
  mobilePhone: true,
  whatsappNumber: true,
  email: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  website: true,
  shortBio: true,
  profilePhoto: true,
  profileThumbnail: true,
  showPhoto: true,
  showEmail: true,
  showPhone: true,
  showAddress: true,
  showSocialLinks: true,
  socialLinks: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      platform: true,
      label: true,
      url: true,
      isActive: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.ContactProfileSelect;

function present<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function sourceFromProfile(profile: VCardProfile): VCardSource {
  const socialLinks = profile.showSocialLinks
    ? profile.socialLinks.flatMap((link) => {
        const url = safeHttpUrl(link.url);
        if (!link.isActive || !url) return [];
        const fallback = link.platform === "X"
          ? "X"
          : link.platform.charAt(0) + link.platform.slice(1).toLowerCase();
        return [{ label: link.label ?? fallback, url }];
      })
    : [];
  const website = safeHttpUrl(profile.website);
  return {
    firstName: profile.firstName,
    ...(profile.lastName ? { lastName: profile.lastName } : {}),
    displayName: profile.displayName,
    ...(profile.honorificPrefix ? { honorificPrefix: profile.honorificPrefix } : {}),
    ...(profile.honorificSuffix ? { honorificSuffix: profile.honorificSuffix } : {}),
    companyName: profile.companyName,
    jobTitle: profile.jobTitle,
    ...(profile.department ? { department: profile.department } : {}),
    ...(profile.showPhone && profile.workPhone ? { workPhone: profile.workPhone } : {}),
    ...(profile.showPhone && profile.mobilePhone ? { mobilePhone: profile.mobilePhone } : {}),
    ...(profile.showPhone && profile.whatsappNumber
      ? { whatsappNumber: profile.whatsappNumber }
      : {}),
    ...(profile.showEmail ? { email: profile.email } : {}),
    ...(profile.showAddress
      ? {
          address: {
            line1: present(profile.addressLine1),
            line2: present(profile.addressLine2),
            city: present(profile.city),
            province: present(profile.province),
            postalCode: present(profile.postalCode),
            country: present(profile.country),
          },
        }
      : {}),
    ...(website ? { website } : {}),
    ...(socialLinks.length ? { socialLinks } : {}),
    ...(profile.shortBio ? { shortBio: profile.shortBio } : {}),
  };
}

async function photoAsJpegBase64(profile: VCardProfile): Promise<string | undefined> {
  if (!profile.showPhoto) return undefined;
  const publicPath = safePublicAsset(profile.profileThumbnail ?? profile.profilePhoto, "profiles");
  if (!publicPath) return undefined;
  const publicRoot = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicRoot, publicPath.replace(/^\/+/, ""));
  const allowedRoot = path.resolve(publicRoot, "uploads", "profiles");
  if (!filePath.startsWith(`${allowedRoot}${path.sep}`)) return undefined;
  try {
    const jpeg = await sharp(filePath)
      .resize(160, 160, { fit: "cover" })
      .flatten({ background: "#FFFFFF" })
      .jpeg({ quality: 82, chromaSubsampling: "4:2:0" })
      .toBuffer();
    return jpeg.toString("base64");
  } catch {
    console.error("Foto profil tidak tersedia saat membuat vCard.");
    return undefined;
  }
}

async function renderProfileVCard(profile: VCardProfile, includePhoto: boolean): Promise<string> {
  const source = sourceFromProfile(profile);
  const photoJpegBase64 = includePhoto ? await photoAsJpegBase64(profile) : undefined;
  return generateVCard({ ...source, ...(photoJpegBase64 ? { photoJpegBase64 } : {}) });
}

export async function getAdminVCard(
  session: AuthenticatedSession,
  profileId: string,
  options: { includePhoto?: boolean } = {},
): Promise<{ slug: string; content: string }> {
  const profile = await getProfileForSession(session, profileId);
  return {
    slug: profile.slug,
    content: await renderProfileVCard(profile, options.includePhoto ?? true),
  };
}

export async function getPublicVCard(slug: string): Promise<{ profileId: string; slug: string; content: string }> {
  const profile = await prisma.contactProfile.findFirst({
    where: {
      slug,
      status: ProfileStatus.ACTIVE,
      company: { is: { isActive: true } },
    },
    select: publicVCardSelect,
  });
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profil tidak ditemukan.");
  return { profileId: profile.id, slug: profile.slug, content: await renderProfileVCard(profile, true) };
}

export async function getDirectVCard(
  session: AuthenticatedSession,
  profileId: string,
): Promise<{ slug: string; content: string }> {
  return getAdminVCard(session, profileId, { includePhoto: false });
}
