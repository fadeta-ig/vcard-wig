"use client";

import {
  Activity,
  Building2,
  ContactRound,
  LayoutDashboard,
  ScrollText,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale, MessageKey } from "@/i18n/messages";
import { translate } from "@/i18n/messages";

type NavigationItem = {
  href: Route;
  key: MessageKey;
  icon: typeof LayoutDashboard;
  superAdminOnly?: boolean;
};

const primaryItems: NavigationItem[] = [
  { href: "/admin", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/admin/profiles", key: "nav.profiles", icon: ContactRound },
  { href: "/admin/analytics", key: "nav.analytics", icon: Activity },
];

const managementItems: NavigationItem[] = [
  {
    href: "/admin/companies",
    key: "nav.companies",
    icon: Building2,
    superAdminOnly: true,
  },
  {
    href: "/admin/settings/company",
    key: "nav.companySettings",
    icon: Settings2,
    superAdminOnly: true,
  },
  {
    href: "/admin/settings/admins",
    key: "nav.admins",
    icon: UsersRound,
    superAdminOnly: true,
  },
  {
    href: "/admin/audit-logs",
    key: "nav.auditLogs",
    icon: ScrollText,
    superAdminOnly: true,
  },
];

export function AdminNavigation({
  locale,
  role,
  onNavigate,
}: {
  locale: Locale;
  role: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const renderItem = (item: NavigationItem) => {
    if (item.superAdminOnly && role !== "SUPER_ADMIN") return null;
    const active =
      item.href === "/admin"
        ? pathname === item.href
        : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={active ? "is-active" : undefined}
        aria-label={translate(locale, item.key)}
        title={translate(locale, item.key)}
        aria-current={active ? "page" : undefined}
        onClick={(event) => {
          if (!event.defaultPrevented) onNavigate?.();
        }}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{translate(locale, item.key)}</span>
      </Link>
    );
  };

  return (
    <nav className="sidebar-nav" aria-label="Admin navigation">
      {primaryItems.map(renderItem)}
      {role === "SUPER_ADMIN" ? (
        <p className="sidebar-nav-section">
          {locale === "id" ? "Pengelolaan" : "Management"}
        </p>
      ) : null}
      {managementItems.map(renderItem)}
      <Link
        href="/admin/settings/security"
        aria-label={locale === "id" ? "Keamanan akun" : "Account security"}
        title={locale === "id" ? "Keamanan akun" : "Account security"}
        className={
          pathname === "/admin/settings/security" ? "is-active" : undefined
        }
        aria-current={
          pathname === "/admin/settings/security" ? "page" : undefined
        }
        onClick={() => onNavigate?.()}
      >
        <ShieldCheck size={18} aria-hidden="true" />
        <span>{locale === "id" ? "Keamanan akun" : "Account security"}</span>
      </Link>
    </nav>
  );
}
