import { Prisma, ProfileStatus } from "@/generated/prisma/client";
import { isPublicSlug, type PublicProfileResult } from "@/lib/public-profile";
import { presentProfile, presentationBrand } from "@/lib/profile-presentation";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/security/crypto";

const publicProfileSelect = {
  slug: true,
  displayName: true,
  honorificPrefix: true,
  honorificSuffix: true,
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
  showWorkPhone: true,
  showMobilePhone: true,
  showWhatsapp: true,
  allowIndexing: true,
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

export async function getPublicProfileBySlug(
  slug: string,
): Promise<PublicProfileResult> {
  if (!isPublicSlug(slug)) return { kind: "not_found" };
  const profile = await prisma.contactProfile.findUnique({
    where: { slug },
    select: publicProfileSelect,
  });
  if (
    !profile ||
    !profile.company.isActive ||
    profile.status === ProfileStatus.DRAFT ||
    profile.status === ProfileStatus.ARCHIVED
  )
    return { kind: "not_found" };
  if (profile.status === ProfileStatus.INACTIVE)
    return {
      kind: "inactive",
      profile: {
        slug: profile.slug,
        brand: presentationBrand(profile.company),
      },
    };
  return { kind: "active", profile: presentProfile(profile, hashToken) };
}
