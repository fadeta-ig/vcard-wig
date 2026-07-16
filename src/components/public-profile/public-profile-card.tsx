import {
  Building2,
  Download,
  Globe2,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties, ReactNode } from "react";
import { SiWhatsapp } from "react-icons/si";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  PublicProfileViewTracker,
  TrackedLink,
} from "@/components/public-profile/public-event-tracker";
import { ShareAction } from "@/components/public-profile/share-action";
import { SocialPlatformIcon } from "@/components/ui/social-platform-icon";
import type { Locale } from "@/i18n/messages";
import { publicProfileMessages } from "@/i18n/public-profile-messages";
import type {
  ActivePublicProfile,
  InactivePublicProfile,
  PublicContactAction,
  PublicSocialLink,
} from "@/lib/public-profile";

const platformNames: Record<PublicSocialLink["platform"], string> = {
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  X: "X",
  THREADS: "Threads",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  TELEGRAM: "Telegram",
  WHATSAPP: "WhatsApp",
  GITHUB: "GitHub",
  WEBSITE: "Website",
  CUSTOM: "Link",
};

function brandStyle(brand: ActivePublicProfile["brand"]): CSSProperties {
  return {
    "--public-brand": brand.primaryColor,
    "--public-brand-foreground": brand.foregroundColor,
    "--public-secondary": brand.secondaryColor ?? brand.primaryColor,
  } as CSSProperties;
}

function ExternalContactRow({
  action,
  icon,
  label,
  external = false,
  accessibleLabel,
  iconClassName,
  slug,
  eventType,
}: {
  action: PublicContactAction;
  icon: ReactNode;
  label?: string;
  external?: boolean;
  accessibleLabel?: string;
  iconClassName?: string;
  slug: string;
  eventType?: "PHONE_CLICK" | "WHATSAPP_CLICK" | "EMAIL_CLICK";
}) {
  return (
    <TrackedLink
      className="public-contact-row"
      href={action.href}
      aria-label={accessibleLabel}
      slug={slug}
      eventType={eventType}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className={["public-contact-icon", iconClassName].filter(Boolean).join(" ")} aria-hidden="true">{icon}</span>
      <span>
        {label ? <small>{label}</small> : null}
        <strong>{action.value}</strong>
      </span>
    </TrackedLink>
  );
}

export function PublicProfileCard({
  profile,
  locale,
  canonicalUrl,
}: {
  profile: ActivePublicProfile;
  locale: Locale;
  canonicalUrl: string;
}) {
  const copy = publicProfileMessages(locale);
  const contact = profile.contact;
  const callAction = contact.mobilePhone ?? contact.workPhone;
  const hasContact = Object.keys(contact).length > 0;

  function renderSection(section: ActivePublicProfile["sectionOrder"][number]) {
    if (section === "CONTACT") {
      if (!hasContact) return null;
      return (
        <section className="public-profile-section" aria-labelledby="public-contact-title" key={section}>
          <h2 id="public-contact-title">{copy.contact}</h2>
          <div className="public-contact-list">
            {contact.mobilePhone ? <ExternalContactRow slug={profile.slug} eventType="PHONE_CLICK" action={contact.mobilePhone} icon={<Phone size={18} />} label={copy.mobilePhone} /> : null}
            {contact.workPhone ? <ExternalContactRow slug={profile.slug} eventType="PHONE_CLICK" action={contact.workPhone} icon={<Phone size={18} />} label={copy.workPhone} /> : null}
            {contact.whatsapp ? <ExternalContactRow slug={profile.slug} eventType="WHATSAPP_CLICK" action={contact.whatsapp} icon={<SiWhatsapp size={18} />} accessibleLabel={`${copy.whatsapp} ${contact.whatsapp.value}`} iconClassName="is-whatsapp" external /> : null}
            {contact.email ? <ExternalContactRow slug={profile.slug} eventType="EMAIL_CLICK" action={contact.email} icon={<Mail size={18} />} label={copy.email} /> : null}
            {contact.website ? <ExternalContactRow slug={profile.slug} action={contact.website} icon={<Globe2 size={18} />} label={copy.website} external /> : null}
          </div>
        </section>
      );
    }
    if (section === "SOCIAL") {
      if (!profile.socialLinks?.length) return null;
      return (
        <section className="public-profile-section" aria-labelledby="public-social-title" key={section}>
          <h2 id="public-social-title">{copy.social}</h2>
          <div className="public-social-list">
            {profile.socialLinks.map((link, index) => {
              const label = link.label || platformNames[link.platform];
              const accessibleLabel = `${label}${link.username ? `, ${link.username}` : ""} (${copy.opensNewTab})`;
              return (
                <TrackedLink
                  className="public-social-link"
                  href={link.href}
                  slug={profile.slug}
                  eventType="SOCIAL_CLICK"
                  targetId={link.trackingId}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={accessibleLabel}
                  title={label}
                  key={`${link.platform}-${index}`}
                >
                  <SocialPlatformIcon platform={link.platform} label={label} size={22} className="public-social-brand" decorative />
                </TrackedLink>
              );
            })}
          </div>
        </section>
      );
    }
    if (section === "ADDRESS") {
      if (!profile.address?.length) return null;
      return (
        <section className="public-profile-section" aria-labelledby="public-address-title" key={section}>
          <h2 id="public-address-title">{copy.address}</h2>
          <div className="public-address">
            <MapPin size={19} aria-hidden="true" />
            <address>{profile.address.map((line) => <span key={line}>{line}</span>)}</address>
          </div>
        </section>
      );
    }
    if (!profile.shortBio) return null;
    return (
      <section className="public-profile-section" aria-labelledby="public-about-title" key={section}>
        <h2 id="public-about-title">{copy.about}</h2>
        <p className="public-profile-bio">{profile.shortBio}</p>
      </section>
    );
  }

  return (
    <main className="public-profile-shell" style={brandStyle(profile.brand)}>
      <PublicProfileViewTracker slug={profile.slug} />
      <article className="public-profile-card">
        <header className="public-card-toolbar">
          <div className="public-company-brand">
            {profile.brand.logoUrl ? (
              <Image src={profile.brand.logoUrl} alt={`${copy.companyLogoAlt} ${profile.brand.name}`} width={136} height={48} className="public-company-logo" priority />
            ) : (
              <span className="public-company-name"><Building2 size={17} aria-hidden="true" />{profile.brand.name}</span>
            )}
          </div>
          <LanguageSwitcher locale={locale} />
        </header>

        <div className="public-profile-hero">
          {profile.photoUrl ? (
            <Image src={profile.photoUrl} alt={`${copy.profilePhotoAlt} ${profile.formattedName}`} width={132} height={132} className="public-profile-photo" priority />
          ) : (
            <div className="public-profile-initials" aria-hidden="true">{profile.displayName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</div>
          )}
          <div className="public-profile-identity">
            <h1>{profile.formattedName}</h1>
            <p className="public-job-title">{profile.jobTitle}</p>
            {profile.department ? <p className="public-department">{profile.department}</p> : null}
            <p className="public-company-line">{profile.companyName}</p>
          </div>
        </div>

        <div className="public-primary-actions" aria-label={copy.contact}>
          <a className="public-save-button" href={`/api/public/contacts/${encodeURIComponent(profile.slug)}/vcard` as Route}>
            <Download size={19} aria-hidden="true" />{copy.saveContact}
          </a>
          <div className="public-quick-actions">
            {callAction ? <TrackedLink slug={profile.slug} eventType="PHONE_CLICK" className="public-action-button" href={callAction.href}><Phone size={19} aria-hidden="true" /><span>{copy.call}</span></TrackedLink> : null}
            {contact.whatsapp ? <TrackedLink slug={profile.slug} eventType="WHATSAPP_CLICK" className="public-action-button" href={contact.whatsapp.href} target="_blank" rel="noopener noreferrer"><SiWhatsapp className="public-whatsapp-icon" size={19} aria-hidden="true" /><span>{copy.whatsapp}</span></TrackedLink> : null}
            {contact.email ? <TrackedLink slug={profile.slug} eventType="EMAIL_CLICK" className="public-action-button" href={contact.email.href}><Mail size={19} aria-hidden="true" /><span>{copy.email}</span></TrackedLink> : null}
            <ShareAction slug={profile.slug} url={canonicalUrl} copy={{ label: copy.share, title: copy.shareTitle, text: `${profile.formattedName} — ${copy.shareText}`, copied: copy.linkCopied, failed: copy.shareFailed }} />
          </div>
        </div>

        <div className="public-profile-sections">{profile.sectionOrder.map(renderSection)}</div>

        <footer className="public-profile-footer">
          <span>{profile.brand.name}</span>
          <Link href={`/privacy?from=${encodeURIComponent(profile.slug)}` as Route}>{copy.privacy}</Link>
        </footer>
      </article>
    </main>
  );
}

export function InactivePublicProfilePage({
  profile,
  locale,
}: {
  profile: InactivePublicProfile;
  locale: Locale;
}) {
  const copy = publicProfileMessages(locale);
  return (
    <main className="public-profile-shell public-status-shell" style={brandStyle(profile.brand)}>
      <section className="public-status-card">
        <div className="public-status-toolbar">
          {profile.brand.logoUrl ? <Image src={profile.brand.logoUrl} alt={`${copy.companyLogoAlt} ${profile.brand.name}`} width={136} height={48} className="public-company-logo" priority /> : <span className="public-company-name"><Building2 size={17} aria-hidden="true" />{profile.brand.name}</span>}
          <LanguageSwitcher locale={locale} />
        </div>
        <div className="public-status-symbol" aria-hidden="true"><Phone size={26} /></div>
        <h1>{copy.inactiveTitle}</h1>
        <p>{copy.inactiveDescription}</p>
        <Link className="public-privacy-link" href={`/privacy?from=${encodeURIComponent(profile.slug)}` as Route}>{copy.privacy}</Link>
      </section>
    </main>
  );
}
