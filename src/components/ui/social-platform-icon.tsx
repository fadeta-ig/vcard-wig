import { Globe2, Link2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { IconType } from "react-icons";
import { FaLinkedinIn } from "react-icons/fa6";
import {
  SiFacebook,
  SiGithub,
  SiInstagram,
  SiTelegram,
  SiThreads,
  SiTiktok,
  SiWhatsapp,
  SiX,
  SiYoutube,
} from "react-icons/si";
import type { SocialPlatform } from "@/lib/profile-options";

const brandIcons: Partial<Record<SocialPlatform, IconType>> = {
  LINKEDIN: FaLinkedinIn,
  INSTAGRAM: SiInstagram,
  FACEBOOK: SiFacebook,
  X: SiX,
  THREADS: SiThreads,
  TIKTOK: SiTiktok,
  YOUTUBE: SiYoutube,
  TELEGRAM: SiTelegram,
  WHATSAPP: SiWhatsapp,
  GITHUB: SiGithub,
};

const brandColors: Record<SocialPlatform, string> = {
  LINKEDIN: "#0A66C2",
  INSTAGRAM: "#E4405F",
  FACEBOOK: "#1877F2",
  X: "#111111",
  THREADS: "#111111",
  TIKTOK: "#111111",
  YOUTUBE: "#FF0000",
  TELEGRAM: "#26A5E4",
  WHATSAPP: "#25D366",
  GITHUB: "#181717",
  WEBSITE: "#1E3A5F",
  CUSTOM: "#667085",
};

export function SocialPlatformIcon({
  platform,
  label,
  size = 18,
  className,
  decorative = false,
}: {
  platform: SocialPlatform;
  label: string;
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const BrandIcon = brandIcons[platform];
  const style = { "--social-brand": brandColors[platform] } as CSSProperties;
  return (
    <span
      className={["social-platform-icon", className].filter(Boolean).join(" ")}
      style={style}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      title={decorative ? undefined : label}
    >
      {BrandIcon ? (
        <BrandIcon size={size} aria-hidden="true" />
      ) : platform === "WEBSITE" ? (
        <Globe2 size={size} aria-hidden="true" />
      ) : (
        <Link2 size={size} aria-hidden="true" />
      )}
    </span>
  );
}
