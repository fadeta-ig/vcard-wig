export const PROFILE_SECTIONS = ["CONTACT", "SOCIAL", "ADDRESS", "BIO"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const DEFAULT_PROFILE_SECTION_ORDER: ProfileSection[] = [...PROFILE_SECTIONS];

export const SOCIAL_PLATFORMS = [
  "LINKEDIN",
  "INSTAGRAM",
  "FACEBOOK",
  "X",
  "THREADS",
  "TIKTOK",
  "YOUTUBE",
  "TELEGRAM",
  "WHATSAPP",
  "GITHUB",
  "WEBSITE",
  "CUSTOM",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_ICONS: Record<SocialPlatform, string> = {
  LINKEDIN: "linkedin",
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  X: "x",
  THREADS: "threads",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube",
  TELEGRAM: "telegram",
  WHATSAPP: "whatsapp",
  GITHUB: "github",
  WEBSITE: "globe",
  CUSTOM: "link",
};

export const PROFILE_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProfileStatusValue = (typeof PROFILE_STATUSES)[number];

export const PROFILE_SORT_OPTIONS = ["newest", "oldest", "name_asc", "most_viewed"] as const;
export type ProfileSort = (typeof PROFILE_SORT_OPTIONS)[number];

export const RESERVED_PROFILE_SLUGS = new Set([
  "admin",
  "api",
  "c",
  "contact",
  "favicon",
  "health",
  "login",
  "logout",
  "privacy",
  "robots",
  "settings",
  "sitemap",
  "uploads",
]);

export function slugifyProfile(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function socialPlatformIcon(platform: SocialPlatform): string {
  return SOCIAL_PLATFORM_ICONS[platform];
}
