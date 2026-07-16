import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getLocale } from "@/i18n/server";
import { getSessionFromCookies } from "@/services/auth.service";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage() {
  const [locale, session] = await Promise.all([getLocale(), getSessionFromCookies()]);
  if (session) {
    redirect(session.user.mustChangePassword ? "/admin/change-password" : "/admin");
  }

  return (
    <AuthShell locale={locale}>
      <LoginForm locale={locale} />
    </AuthShell>
  );
}
