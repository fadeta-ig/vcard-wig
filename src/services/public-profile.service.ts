import { Prisma, ProfileStatus } from "@/generated/prisma/client";
import type { ProfileSection, SocialPlatform } from "@/lib/profile-options";
import { SOCIAL_PLATFORMS } from "@/lib/profile-options";
import {
  emailAction,
  isPublicSlug,
  readableBrandForeground,
  safeBrandColor,
  safeHttpUrl,
  safePublicAsset,
  telephoneAction,
  websiteAction,
  whatsappAction,
  type PublicBrand,
  type PublicProfileResult,
  type PublicSocialLink,
} from "@/lib/public-profile";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/security/crypto";
import { normalizeProfileSectionOrder } from "@/services/profile.service";

const publicProfileSelect = {
  slug: true,
  displayName: true,
  jobTitle: true,
  department: true,
  companyName: true,
  email: true,
  workPhone: true,
  mobilePhone: true,
  whatsappNumber: true,
  website: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  shortBio: true,
  profilePhoto: true,
  status: true,
  showPhoto: true,
  showEmail: true,
  showPhone: true,
  showAddress: true,
  showSocialLinks: true,
  sectionOrder: true,
  company: {
    select: {
      name: true,
      companyLogo: true,
      favicon: true,
      primaryColor: true,
      secondaryColor: true,
      isActive: true,
    },
  },
  socialLinks: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      platform: true,
      label: true,
      username: true,
      url: true,
    },
  },
} satisfies Prisma.ContactProfileSelect;

function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

function publicBrand(company: {
  name: string;
  companyLogo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string | null;
}): PublicBrand {
  const primaryColor = safeBrandColor(company.primaryColor);
  const secondaryColor = company.secondaryColor
    ? safeBrandColor(company.secondaryColor)
    : undefined;
  return {
    name: company.name,
    ...(safePublicAsset(company.companyLogo, "companies")
      ? { logoUrl: safePublicAsset(company.companyLogo, "companies") }
      : {}),
    ...(safePublicAsset(company.favicon, "companies")
      ? { faviconUrl: safePublicAsset(company.favicon, "companies") }
      : {}),
    primaryColor,
    ...(secondaryColor ? { secondaryColor } : {}),
    foregroundColor: readableBrandForeground(primaryColor),
  };
}

function visibleSocialLinks(
  links: { id: string; platform: string; label: string | null; username: string | null; url: string }[],
): PublicSocialLink[] {
  return links.flatMap((link) => {
    const href = safeHttpUrl(link.url);
    if (!href || !isSocialPlatform(link.platform)) return [];
    return [{
      trackingId: hashToken(link.id),
      platform: link.platform,
      ...(link.label ? { label: link.label } : {}),
      ...(link.username ? { username: link.username } : {}),
      href,
    }];
  });
}

export async function getPublicProfileBySlug(slug: string): Promise<PublicProfileResult> {
  if (!isPublicSlug(slug)) return { kind: "not_found" };

  const profile = await prisma.contactProfile.findUnique({
    where: { slug },
    select: publicProfileSelect,
  });
  if (!profile || !profile.company.isActive) return { kind: "not_found" };

  const brand = publicBrand(profile.company);
  if (profile.status === ProfileStatus.DRAFT || profile.status === ProfileStatus.ARCHIVED) {
    return { kind: "not_found" };
  }
  if (profile.status === ProfileStatus.INACTIVE) {
    return { kind: "inactive", profile: { slug: profile.slug, brand } };
  }

  const email = profile.showEmail ? emailAction(profile.email) : undefined;
  const workPhone = profile.showPhone ? telephoneAction(profile.workPhone) : undefined;
  const mobilePhone = profile.showPhone ? telephoneAction(profile.mobilePhone) : undefined;
  const whatsapp = profile.showPhone ? whatsappAction(profile.whatsappNumber) : undefined;
  const website = websiteAction(profile.website);
  const contact = {
    ...(email ? { email } : {}),
    ...(workPhone ? { workPhone } : {}),
    ...(mobilePhone ? { mobilePhone } : {}),
    ...(whatsapp ? { whatsapp } : {}),
    ...(website ? { website } : {}),
  };
  const address = profile.showAddress
    ? [
        profile.addressLine1,
        profile.addressLine2,
        [profile.city, profile.province, profile.postalCode].filter(Boolean).join(" "),
        profile.country,
      ].filter((line): line is string => Boolean(line))
    : [];
  const socialLinks = profile.showSocialLinks ? visibleSocialLinks(profile.socialLinks) : [];
  const photoUrl = profile.showPhoto
    ? safePublicAsset(profile.profilePhoto, "profiles")
    : undefined;

  return {
    kind: "active",
    profile: {
      slug: profile.slug,
      displayName: profile.displayName,
      jobTitle: profile.jobTitle,
      ...(profile.department ? { department: profile.department } : {}),
      companyName: profile.companyName,
      ...(profile.shortBio ? { shortBio: profile.shortBio } : {}),
      ...(photoUrl ? { photoUrl } : {}),
      sectionOrder: normalizeProfileSectionOrder(profile.sectionOrder) as ProfileSection[],
      brand,
      contact,
      ...(address.length ? { address } : {}),
      ...(socialLinks.length ? { socialLinks } : {}),
    },
  };
}
