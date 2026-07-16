import type { Metadata } from "next";
import type { Route } from "next";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { publicProfileMessages } from "@/i18n/public-profile-messages";
import { getLocale } from "@/i18n/server";
import { getEnvironment } from "@/lib/env";
import { absoluteUrl, isPublicSlug } from "@/lib/public-profile";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = publicProfileMessages(locale);
  return {
    title: copy.privacyTitle,
    description: copy.privacyIntro,
    alternates: { canonical: absoluteUrl(getEnvironment().APP_URL, "privacy") },
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [locale, query] = await Promise.all([getLocale(), searchParams]);
  const copy = publicProfileMessages(locale);
  const from = query.from && isPublicSlug(query.from) ? query.from : undefined;
  return (
    <main className="public-profile-shell public-privacy-shell">
      <article className="public-privacy-card">
        <header className="public-privacy-header">
          <div className="public-privacy-icon" aria-hidden="true"><ShieldCheck size={24} /></div>
          <LanguageSwitcher locale={locale} />
        </header>
        <h1>{copy.privacyTitle}</h1>
        <p className="public-privacy-intro">{copy.privacyIntro}</p>
        <section><h2>{copy.privacyAnalyticsTitle}</h2><p>{copy.privacyAnalytics}</p></section>
        <section><h2>{copy.privacyControlTitle}</h2><p>{copy.privacyControl}</p></section>
        <section><h2>{copy.privacyContactTitle}</h2><p>{copy.privacyContact}</p></section>
        {from ? <Link className="public-privacy-link" href={`/c/${from}` as Route}>{copy.backToProfile}</Link> : null}
      </article>
    </main>
  );
}
