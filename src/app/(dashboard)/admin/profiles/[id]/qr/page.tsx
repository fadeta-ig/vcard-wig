import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { QrManager } from "@/components/admin/qr-manager";
import { getLocale } from "@/i18n/server";
import { AppError } from "@/lib/api";
import { getEnvironment } from "@/lib/env";
import { publicProfileUrl } from "@/lib/public-profile";
import type { ProfileStatusValue } from "@/lib/profile-options";
import { getSessionFromCookies } from "@/services/auth.service";
import { getProfileForSession } from "@/services/profile.service";

export const metadata: Metadata = { title: "QR Code & vCard" };

export default async function ProfileQrPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  let profile;
  try {
    profile = await getProfileForSession(session, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  return (
    <QrManager
      locale={locale}
      profile={{
        id: profile.id,
        slug: profile.slug,
        displayName: profile.displayName,
        status: profile.status as ProfileStatusValue,
        company: profile.company,
        publicUrl: publicProfileUrl(getEnvironment().APP_URL, profile.slug),
      }}
    />
  );
}
