import type { ReactNode } from "react";
import { ContactRound } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { translate } from "@/i18n/messages";
import { LanguageSwitcher } from "@/components/language-switcher";

export function AuthShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label={translate(locale, "app.name")}>
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <ContactRound size={21} />
          </span>
          <span>
            <span className="brand-name">{translate(locale, "app.name")}</span>
            <span className="brand-caption">{translate(locale, "app.tagline")}</span>
          </span>
        </div>
        <div className="auth-brand-copy">
          <h2>
            {locale === "id"
              ? "Kontak perusahaan yang konsisten, selalu mutakhir."
              : "Consistent corporate contacts, always up to date."}
          </h2>
          <p>
            {locale === "id"
              ? "Kelola kartu kontak digital, identitas perusahaan, dan akses administrator dari satu tempat."
              : "Manage digital contact cards, company identities, and administrator access in one place."}
          </p>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-top">
          <LanguageSwitcher locale={locale} />
        </div>
        <div className="auth-form-wrap">{children}</div>
      </section>
    </main>
  );
}
