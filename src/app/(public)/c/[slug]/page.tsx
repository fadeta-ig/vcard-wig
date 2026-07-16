import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  InactivePublicProfilePage,
  PublicProfileCard,
} from "@/components/public-profile/public-profile-card";
import { getLocale } from "@/i18n/server";
import { publicProfileMessages } from "@/i18n/public-profile-messages";
import { getEnvironment } from "@/lib/env";
import { absoluteUrl, publicProfileUrl } from "@/lib/public-profile";
import { getPublicProfileBySlug } from "@/services/public-profile.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageContext = { params: Promise<{ slug: string }> };
const getProfile = cache((slug: string) => getPublicProfileBySlug(slug));

export async function generateMetadata({ params }: PageContext): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const copy = publicProfileMessages(locale);
  const result = await getProfile(slug);
  const origin = getEnvironment().APP_URL;
  const canonical = publicProfileUrl(origin, slug);

  if (result.kind === "not_found") {
    return {
      title: copy.notFoundTitle,
      description: copy.notFoundDescription,
      robots: { index: false, follow: false },
    };
  }
  if (result.kind === "inactive") {
    return {
      title: copy.inactiveTitle,
      description: copy.inactiveDescription,
      alternates: { canonical },
      robots: { index: false, follow: false },
      ...(result.profile.brand.faviconUrl
        ? { icons: { icon: absoluteUrl(origin, result.profile.brand.faviconUrl) } }
        : {}),
    };
  }

  const profile = result.profile;
  const description = locale === "en"
    ? `${profile.jobTitle}${profile.department ? `, ${profile.department}` : ""} at ${profile.companyName}. Digital contact card.`
    : `${profile.jobTitle}${profile.department ? `, ${profile.department}` : ""} di ${profile.companyName}. Kartu kontak digital.`;
  const image = profile.photoUrl ?? profile.brand.logoUrl;
  return {
    title: `${profile.formattedName} — ${profile.jobTitle}`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    ...(profile.brand.faviconUrl
      ? { icons: { icon: absoluteUrl(origin, profile.brand.faviconUrl) } }
      : {}),
    openGraph: {
      type: "website",
      url: canonical,
      siteName: profile.brand.name,
      title: `${profile.formattedName} — ${profile.jobTitle}`,
      description,
      ...(image ? { images: [{ url: absoluteUrl(origin, image), alt: profile.formattedName }] } : {}),
    },
  };
}

export default async function PublicProfilePage({ params }: PageContext) {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const result = await getProfile(slug);
  if (result.kind === "not_found") notFound();
  if (result.kind === "inactive") {
    return <InactivePublicProfilePage profile={result.profile} locale={locale} />;
  }
  return (
    <PublicProfileCard
      profile={result.profile}
      locale={locale}
      canonicalUrl={publicProfileUrl(getEnvironment().APP_URL, result.profile.slug)}
    />
  );
}
