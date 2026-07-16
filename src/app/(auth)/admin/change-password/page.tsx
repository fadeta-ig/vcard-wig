import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getLocale } from "@/i18n/server";
import { getSessionFromCookies } from "@/services/auth.service";

export const metadata: Metadata = { title: "Change Password" };

export default async function ChangePasswordPage() {
  const [locale, session] = await Promise.all([getLocale(), getSessionFromCookies()]);
  if (!session) redirect("/admin/login");
  if (!session.user.mustChangePassword) redirect("/admin");

  return (
    <AuthShell locale={locale}>
      <ChangePasswordForm locale={locale} />
    </AuthShell>
  );
}
