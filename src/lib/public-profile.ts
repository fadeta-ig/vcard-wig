import type { ProfileSection, SocialPlatform } from "@/lib/profile-options";

export const DEFAULT_PUBLIC_BRAND = "#1E3A5F";

export type PublicBrand = {
  name: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  foregroundColor: "#FFFFFF" | "#1A1D21";
};

export type PublicContactAction = {
  value: string;
  href: string;
};

export type PublicSocialLink = {
  trackingId: string;
  platform: SocialPlatform;
  label?: string;
  username?: string;
  href: string;
};

export type ActivePublicProfile = {
  slug: string;
  displayName: string;
  formattedName: string;
  jobTitle: string;
  department?: string;
  companyName: string;
  shortBio?: string;
  photoUrl?: string;
  sectionOrder: ProfileSection[];
  brand: PublicBrand;
  contact: {
    email?: PublicContactAction;
    workPhone?: PublicContactAction;
    mobilePhone?: PublicContactAction;
    whatsapp?: PublicContactAction;
    website?: PublicContactAction;
  };
  address?: string[];
  socialLinks?: PublicSocialLink[];
};

export type InactivePublicProfile = {
  slug: string;
  brand: PublicBrand;
};

export type PublicProfileResult =
  | { kind: "active"; profile: ActivePublicProfile }
  | { kind: "inactive"; profile: InactivePublicProfile }
  | { kind: "not_found" };

const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const INTERNATIONAL_PHONE = /^\+[1-9]\d{6,14}$/;
const PUBLIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanNamePart(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function comparableName(value: string): string {
  return value.toLocaleLowerCase("id-ID").replace(/,\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function formatPublicDisplayName(
  displayName: string,
  honorificPrefix?: string | null,
  honorificSuffix?: string | null,
): string {
  const name = cleanNamePart(displayName);
  const prefix = cleanNamePart(honorificPrefix);
  const suffix = cleanNamePart(honorificSuffix).replace(/^[,\s]+/, "");
  const comparableBaseName = comparableName(name);
  const comparablePrefix = comparableName(prefix);
  const hasPrefix = Boolean(
    prefix &&
      comparableBaseName.startsWith(comparablePrefix) &&
      (
        comparableBaseName.length === comparablePrefix.length ||
        comparableBaseName[comparablePrefix.length] === " " ||
        /[.,]$/.test(comparablePrefix)
      ),
  );
  let formatted = prefix && !hasPrefix ? `${prefix} ${name}` : name;

  const comparableSuffix = comparableName(suffix);
  const comparableFormatted = comparableName(formatted);
  const hasSuffix = Boolean(
    suffix &&
      (
        comparableFormatted === comparableSuffix ||
        comparableFormatted.endsWith(` ${comparableSuffix}`)
      ),
  );
  if (suffix && !hasSuffix) {
    formatted = `${formatted.replace(/[,\s]+$/, "")}, ${suffix}`;
  }
  return formatted;
}

export function safeBrandColor(value: string | null | undefined): string {
  return value && HEX_COLOR.test(value) ? value.toUpperCase() : DEFAULT_PUBLIC_BRAND;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function colorContrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(safeBrandColor(first));
  const secondLuminance = relativeLuminance(safeBrandColor(second));
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableBrandForeground(hex: string): "#FFFFFF" | "#1A1D21" {
  const color = safeBrandColor(hex);
  const luminance = relativeLuminance(color);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkLuminance = relativeLuminance("#1A1D21");
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
  return whiteContrast >= darkContrast ? "#FFFFFF" : "#1A1D21";
}

export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (!(["http:", "https:"] as string[]).includes(parsed.protocol)) return undefined;
    if (parsed.username || parsed.password || !parsed.hostname) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function safePublicAsset(
  value: string | null | undefined,
  category: "companies" | "profiles",
): string | undefined {
  if (!value) return undefined;
  const prefix = `/uploads/${category}/`;
  if (!value.startsWith(prefix) || value.includes("..") || value.includes("\\")) return undefined;
  return value;
}

export function telephoneAction(value: string | null | undefined): PublicContactAction | undefined {
  if (!value || !INTERNATIONAL_PHONE.test(value)) return undefined;
  return { value, href: `tel:${value}` };
}

export function whatsappAction(value: string | null | undefined): PublicContactAction | undefined {
  if (!value || !INTERNATIONAL_PHONE.test(value)) return undefined;
  return { value, href: `https://wa.me/${value.slice(1)}` };
}

export function emailAction(value: string | null | undefined): PublicContactAction | undefined {
  if (!value || /[\r\n?&]/.test(value)) return undefined;
  return { value, href: `mailto:${value}` };
}

export function websiteAction(value: string | null | undefined): PublicContactAction | undefined {
  const href = safeHttpUrl(value);
  return href ? { value: href, href } : undefined;
}

export function isPublicSlug(value: string): boolean {
  return value.length >= 2 && value.length <= 100 && PUBLIC_SLUG.test(value);
}

export function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin.endsWith("/") ? origin : `${origin}/`).toString();
}

export function publicProfileUrl(origin: string, slug: string): string {
  return absoluteUrl(origin, `c/${encodeURIComponent(slug)}`);
}
