import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/admin/profile-editor";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { resolveSelectedCompany } from "@/services/authorization.service";
import { getSessionFromCookies } from "@/services/auth.service";

export const metadata: Metadata = { title: "Add Profile" };

export default async function NewProfilePage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  const [locale, selected] = await Promise.all([getLocale(), resolveSelectedCompany(session)]);
  if (!selected) redirect("/admin/profiles");
  const company = await prisma.company.findUnique({
    where: { id: selected.id },
    select: {
      id: true,
      name: true,
      companyLogo: true,
      primaryColor: true,
      secondaryColor: true,
      qrLogoEnabled: true,
      defaultQrForeground: true,
      defaultQrBackground: true,
    },
  });
  if (!company) redirect("/admin/profiles");
  return <ProfileEditor locale={locale} company={company} initialProfile={null} />;
}
