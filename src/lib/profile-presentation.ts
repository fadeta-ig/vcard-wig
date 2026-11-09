import {
  DEFAULT_PROFILE_SECTION_ORDER,
  PROFILE_SECTIONS,
  SOCIAL_PLATFORMS,
  type ProfileSection,
  type SocialPlatform,
} from "@/lib/profile-options";
import {
  emailAction,
  formatPublicDisplayName,
  readableBrandForeground,
  safeBrandColor,
  safeHttpUrl,
  safePublicAsset,
  telephoneAction,
  websiteAction,
  whatsappAction,
  type ActivePublicProfile,
  type PublicBrand,
} from "@/lib/public-profile";

type OptionalText = string | null | undefined;
export type PresentationSource = {
  slug: string;
  displayName: string;
  honorificPrefix?: OptionalText;
  honorificSuffix?: OptionalText;
  jobTitle: string;
  department?: OptionalText;
  companyName: string;
  shortBio?: OptionalText;
  email?: OptionalText;
  workPhone?: OptionalText;
  mobilePhone?: OptionalText;
  whatsappNumber?: OptionalText;
  website?: OptionalText;
  addressLine1?: OptionalText;
  addressLine2?: OptionalText;
  city?: OptionalText;
  province?: OptionalText;
  postalCode?: OptionalText;
  country?: OptionalText;
  profilePhoto?: OptionalText;
  showPhoto: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showWorkPhone?: boolean;
  showMobilePhone?: boolean;
  showWhatsapp?: boolean;
  allowIndexing?: boolean;
  showAddress: boolean;
  showSocialLinks: boolean;
  sectionOrder: unknown;
  company: {
    name: string;
    companyLogo?: OptionalText;
    favicon?: OptionalText;
    primaryColor: string;
    secondaryColor?: OptionalText;
  };
  socialLinks: {
    id: string;
    platform: string;
    url: string;
    label?: OptionalText;
    username?: OptionalText;
    isActive?: boolean;
  }[];
};

export function presentationBrand(
  company: PresentationSource["company"],
): PublicBrand {
  const primaryColor = safeBrandColor(company.primaryColor);
  return {
    name: company.name,
    logoUrl: safePublicAsset(company.companyLogo, "companies"),
    faviconUrl: safePublicAsset(company.favicon, "companies"),
    primaryColor,
    secondaryColor: company.secondaryColor
      ? safeBrandColor(company.secondaryColor)
      : undefined,
    foregroundColor: readableBrandForeground(primaryColor),
  };
}

export function presentProfile(
  source: PresentationSource,
  trackingId: (id: string) => string = (id) => id,
  previewPhoto?: string,
): ActivePublicProfile {
  const sections =
    Array.isArray(source.sectionOrder) &&
    source.sectionOrder.length === PROFILE_SECTIONS.length &&
    new Set(source.sectionOrder).size === PROFILE_SECTIONS.length &&
    source.sectionOrder.every((value) => PROFILE_SECTIONS.includes(value))
      ? (source.sectionOrder as ProfileSection[])
      : [...DEFAULT_PROFILE_SECTION_ORDER];
  const email = source.showEmail ? emailAction(source.email) : undefined;
  const workPhone =
    source.showPhone && source.showWorkPhone !== false
      ? telephoneAction(source.workPhone)
      : undefined;
  const mobilePhone =
    source.showPhone && source.showMobilePhone !== false
      ? telephoneAction(source.mobilePhone)
      : undefined;
  const whatsapp =
    source.showPhone && source.showWhatsapp !== false
      ? whatsappAction(source.whatsappNumber)
      : undefined;
  const website = websiteAction(source.website);
  const address = source.showAddress
    ? [
        source.addressLine1,
        source.addressLine2,
        [source.city, source.province, source.postalCode]
          .filter(Boolean)
          .join(" "),
        source.country,
      ].filter((value): value is string => Boolean(value))
    : [];
  const socialLinks = source.showSocialLinks
    ? source.socialLinks.flatMap((link) => {
        const href = safeHttpUrl(link.url);
        if (
          link.isActive === false ||
          !href ||
          !(SOCIAL_PLATFORMS as readonly string[]).includes(link.platform)
        )
          return [];
        return [
          {
            trackingId: trackingId(link.id),
            platform: link.platform as SocialPlatform,
            href,
            label: link.label || undefined,
            username: link.username || undefined,
          },
        ];
      })
    : [];
  return {
    slug: source.slug,
    displayName: source.displayName,
    formattedName: formatPublicDisplayName(
      source.displayName,
      source.honorificPrefix,
      source.honorificSuffix,
    ),
    jobTitle: source.jobTitle,
    companyName: source.companyName,
    department: source.department || undefined,
    shortBio: source.shortBio || undefined,
    showAvatar: source.showPhoto,
    allowIndexing: source.allowIndexing ?? false,
    photoUrl: source.showPhoto
      ? (previewPhoto ?? safePublicAsset(source.profilePhoto, "profiles"))
      : undefined,
    sectionOrder: sections,
    brand: presentationBrand(source.company),
    contact: {
      ...(email ? { email } : {}),
      ...(workPhone ? { workPhone } : {}),
      ...(mobilePhone ? { mobilePhone } : {}),
      ...(whatsapp ? { whatsapp } : {}),
      ...(website ? { website } : {}),
    },
    ...(address.length ? { address } : {}),
    ...(socialLinks.length ? { socialLinks } : {}),
  };
}
