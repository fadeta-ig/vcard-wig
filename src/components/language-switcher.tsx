"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/messages";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();

  const changeLocale = (nextLocale: Locale) => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `vcard_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  };

  return (
    <div className="language-switcher" aria-label="Language">
      <Languages aria-hidden="true" size={16} />
      <button
        type="button"
        className={locale === "id" ? "is-active" : undefined}
        onClick={() => changeLocale("id")}
        aria-pressed={locale === "id"}
      >
        ID
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        className={locale === "en" ? "is-active" : undefined}
        onClick={() => changeLocale("en")}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
