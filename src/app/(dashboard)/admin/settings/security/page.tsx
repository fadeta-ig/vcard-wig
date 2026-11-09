import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/services/auth.service";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { mfaConfigured } from "@/lib/security/totp";
import { SecuritySettings } from "@/components/auth/security-settings";

export default async function SecurityPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  const [user, locale] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaSecretEncrypted: true },
    }),
    getLocale(),
  ]);
  return (
    <SecuritySettings
      locale={locale}
      enabled={Boolean(user?.mfaSecretEncrypted)}
      configured={mfaConfigured()}
    />
  );
}
