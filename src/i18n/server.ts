import { cookies } from "next/headers";
import { normalizeLocale, type Locale, translate, type MessageKey } from "@/i18n/messages";

export const LOCALE_COOKIE_NAME = "vcard_locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export async function getTranslator(): Promise<(key: MessageKey) => string> {
  const locale = await getLocale();
  return (key) => translate(locale, key);
}
