import { ContactRound } from "lucide-react";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { CompanySwitcher } from "@/components/admin/company-switcher";
import { LogoutButton } from "@/components/admin/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale } from "@/i18n/server";
import {
  listAccessibleCompanies,
  resolveSelectedCompany,
} from "@/services/authorization.service";
import { getSessionFromCookies } from "@/services/auth.service";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  if (session.user.mustChangePassword) redirect("/admin/change-password");

  const [locale, companies, selectedCompany] = await Promise.all([
    getLocale(),
    listAccessibleCompanies(session),
    resolveSelectedCompany(session),
  ]);

  const style = {
    "--brand-primary": selectedCompany?.primaryColor ?? "#1E3A5F",
  } as CSSProperties;
  const initials = session.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="admin-layout" style={style}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <ContactRound size={21} />
            </span>
            <span>
              <span className="brand-name">Corporate vCard</span>
              <span className="brand-caption">Administration</span>
            </span>
          </div>
        </div>
        <AdminNavigation locale={locale} role={session.user.role} />
        <div className="sidebar-footer">
          <LogoutButton locale={locale} />
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <CompanySwitcher
            locale={locale}
            companies={companies}
            selectedId={selectedCompany?.id}
          />
          <div className="admin-header-actions">
            <LanguageSwitcher locale={locale} />
            <div className="user-summary">
              <span className="user-avatar" aria-hidden="true">
                {initials || "A"}
              </span>
              <div>
                <span className="user-name">{session.user.name}</span>
                <span className="user-role">{session.user.role.replace("_", " ")}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
