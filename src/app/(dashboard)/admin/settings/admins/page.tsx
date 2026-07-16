import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminManager, type AdminView } from "@/components/admin/admin-manager";
import { getLocale } from "@/i18n/server";
import { listAdmins } from "@/services/admin.service";
import { getSessionFromCookies } from "@/services/auth.service";
import { listCompanies } from "@/services/company.service";

export const metadata: Metadata = { title: "Admin Users" };

export default async function AdminUsersPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");
  const [locale, admins, companies] = await Promise.all([
    getLocale(),
    listAdmins(),
    listCompanies(),
  ]);
  const serializedAdmins = admins.map((admin) => ({
    ...admin,
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  })) as AdminView[];
  const companyOptions = companies.map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    isActive: company.isActive,
  }));

  return (
    <AdminManager
      initialAdmins={serializedAdmins}
      companies={companyOptions}
      currentUsername={session.user.username}
      locale={locale}
    />
  );
}
