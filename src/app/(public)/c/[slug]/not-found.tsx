import { SearchX } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { publicProfileMessages } from "@/i18n/public-profile-messages";
import { getLocale } from "@/i18n/server";

export default async function PublicProfileNotFound() {
  const locale = await getLocale();
  const copy = publicProfileMessages(locale);
  return (
    <main className="public-profile-shell public-status-shell">
      <section className="public-status-card">
        <div className="public-status-language"><LanguageSwitcher locale={locale} /></div>
        <div className="public-status-symbol is-muted" aria-hidden="true"><SearchX size={26} /></div>
        <h1>{copy.notFoundTitle}</h1>
        <p>{copy.notFoundDescription}</p>
      </section>
    </main>
  );
}
