"use client";

import {
  Activity,
  Building2,
  ContactRound,
  LayoutDashboard,
  ScrollText,
  Settings2,
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
  { href: "/admin/companies", key: "nav.companies", icon: Building2, superAdminOnly: true },
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
  { href: "/admin/audit-logs", key: "nav.auditLogs", icon: ScrollText, superAdminOnly: true },
];

export function AdminNavigation({ locale, role }: { locale: Locale; role: string }) {
  const pathname = usePathname();
  const renderItem = (item: NavigationItem) => {
    if (item.superAdminOnly && role !== "SUPER_ADMIN") return null;
    const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} className={active ? "is-active" : undefined}>
        <Icon size={18} aria-hidden="true" />
        <span>{translate(locale, item.key)}</span>
      </Link>
    );
  };

  return (
    <nav className="sidebar-nav" aria-label="Admin navigation">
      {primaryItems.map(renderItem)}
      <p className="sidebar-nav-section">Management</p>
      {managementItems.map(renderItem)}
    </nav>
  );
}
