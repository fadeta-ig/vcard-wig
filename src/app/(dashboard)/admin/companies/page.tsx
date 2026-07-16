import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompanyManager, type CompanyView } from "@/components/admin/company-manager";
import { getLocale } from "@/i18n/server";
import { getSessionFromCookies } from "@/services/auth.service";
import { listCompanies } from "@/services/company.service";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");
  const [locale, companies] = await Promise.all([getLocale(), listCompanies()]);
  const serialized = companies.map((company) => ({
    ...company,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  })) as CompanyView[];

  return <CompanyManager initialCompanies={serialized} locale={locale} />;
}
