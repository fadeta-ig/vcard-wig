import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProfileEditor } from "@/components/admin/profile-editor";
import { getLocale } from "@/i18n/server";
import { AppError } from "@/lib/api";
import type { ProfileSection, ProfileStatusValue, SocialPlatform } from "@/lib/profile-options";
import type { ProfileView } from "@/lib/profile-types";
import { getSessionFromCookies } from "@/services/auth.service";
import { getProfileForSession } from "@/services/profile.service";

export const metadata: Metadata = { title: "Edit Profile" };

type PageContext = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function EditProfilePage({ params, searchParams }: PageContext) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  const [{ id }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  let profile;
  try {
    profile = await getProfileForSession(session, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const serialized: ProfileView = {
    ...profile,
    status: profile.status as ProfileStatusValue,
    sectionOrder: profile.sectionOrder as ProfileSection[],
    publishedAt: profile.publishedAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    socialLinks: profile.socialLinks.map((link) => ({
      ...link,
      platform: link.platform as SocialPlatform,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    })),
  };
  const notice = ["created", "saved", "photo-error"].includes(query.notice ?? "")
    ? (query.notice as "created" | "saved" | "photo-error")
    : undefined;
  return <ProfileEditor locale={locale} company={serialized.company} initialProfile={serialized} initialNotice={notice} />;
}
