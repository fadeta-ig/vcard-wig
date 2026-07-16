import {
  Activity,
  ContactRound,
  ExternalLink,
  UserCheck,
  UserX,
} from "lucide-react";
import { UserRole } from "@/generated/prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { ProfileStatusBadge } from "@/components/ui/profile-status-badge";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { phase6Messages } from "@/i18n/phase6-messages";
import {
  listAccessibleCompanies,
  resolveSelectedCompany,
} from "@/services/authorization.service";
import { getDashboardData, resolveAnalyticsScope } from "@/services/analytics.service";
import { getSessionFromCookies } from "@/services/auth.service";

export const metadata: Metadata = { title: "Dashboard" };

type PageProps = { searchParams: Promise<{ scope?: string }> };

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  const [locale, companies, selectedCompany, query] = await Promise.all([
    getLocale(),
    listAccessibleCompanies(session),
    resolveSelectedCompany(session),
    searchParams,
  ]);
  const copy = phase6Messages(locale);
  const requestedScope =
    session.user.role === UserRole.SUPER_ADMIN && query.scope === "global"
      ? "global"
      : undefined;
  const scope = resolveAnalyticsScope(session, selectedCompany, requestedScope);
  const dashboard = await getDashboardData(scope);
  const maxDaily = Math.max(1, ...dashboard.dailyEvents.map((item) => item.total));
  const dateFormatter = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
  const statusLabel = {
    DRAFT: locale === "id" ? "Draft" : "Draft",
    ACTIVE: locale === "id" ? "Aktif" : "Active",
    INACTIVE: locale === "id" ? "Nonaktif" : "Inactive",
    ARCHIVED: locale === "id" ? "Arsip" : "Archived",
  } as const;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{translate(locale, "dashboard.title")}</h1>
          <p>{translate(locale, "dashboard.welcome")}, {session.user.name}. {copy.dashboardSubtitle}</p>
        </div>
        {session.user.role === UserRole.SUPER_ADMIN ? (
          <nav className="scope-switch" aria-label="Analytics scope">
            <Link className={scope.kind === "company" ? "is-active" : ""} href={"/admin" as Route}>{copy.companyScope}</Link>
            <Link className={scope.kind === "global" ? "is-active" : ""} href={"/admin?scope=global" as Route}>{copy.globalScope}</Link>
          </nav>
        ) : null}
      </div>

      <p className="scope-caption">{scope.label} · {companies.filter((item) => item.isActive).length} {locale === "id" ? "perusahaan dapat diakses" : "accessible companies"}</p>

      <section className="summary-row phase6-summary" aria-label="Analytics summary">
        <div className="summary-item"><ContactRound size={20} aria-hidden="true" /><p className="summary-label">{copy.totalProfiles}</p><strong className="summary-value">{dashboard.totalProfiles}</strong><span className="summary-detail">{copy.statusDetail.replace("{draft}", String(dashboard.draftProfiles)).replace("{archived}", String(dashboard.archivedProfiles))}</span></div>
        <div className="summary-item"><UserCheck size={20} aria-hidden="true" /><p className="summary-label">{copy.activeProfiles}</p><strong className="summary-value">{dashboard.activeProfiles}</strong></div>
        <div className="summary-item"><UserX size={20} aria-hidden="true" /><p className="summary-label">{copy.inactiveProfiles}</p><strong className="summary-value">{dashboard.inactiveProfiles}</strong></div>
        <div className="summary-item"><Activity size={20} aria-hidden="true" /><p className="summary-label">{copy.eventsThirtyDays}</p><strong className="summary-value">{dashboard.eventsThirtyDays}</strong></div>
      </section>

      <section className="content-panel analytics-trend-panel" aria-labelledby="activity-trend-title">
        <div className="panel-header">
          <div><h2 id="activity-trend-title">{copy.activityTrend}</h2><p>{copy.activityTrendHelp}</p></div>
          <Link className="button button-secondary button-sm" href={(scope.kind === "global" ? "/admin/analytics?scope=global" : "/admin/analytics") as Route}>{copy.viewAnalytics}<ExternalLink size={14} aria-hidden="true" /></Link>
        </div>
        <div className="analytics-chart" role="img" aria-label={copy.activityTrendHelp}>
          {dashboard.dailyEvents.map((item) => (
            <div className="analytics-chart-column" key={item.day} title={`${item.day}: ${item.total}`}>
              <span className="analytics-chart-value">{item.total}</span>
              <span className="analytics-chart-track"><span className="analytics-chart-bar" style={{ height: item.total ? `${Math.max(8, (item.total / maxDaily) * 100)}%` : "2px" }} /></span>
              <span className="analytics-chart-label">{dateFormatter.format(new Date(`${item.day}T00:00:00+07:00`))}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-data-grid">
        <section className="content-panel">
          <div className="panel-header"><div><h2>{copy.recentProfiles}</h2></div></div>
          <div className="table-scroll">
            <table className="data-table compact-table">
              <thead><tr><th>{copy.profile}</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {dashboard.recentProfiles.map((profile) => (
                  <tr key={profile.id}>
                    <td><span className="entity-name">{profile.displayName}</span><span className="entity-meta">{profile.jobTitle} · {profile.company.name}</span></td>
                    <td><ProfileStatusBadge status={profile.status} label={statusLabel[profile.status]} /></td>
                    <td><Link className="icon-button" title={locale === "id" ? "Edit profil" : "Edit profile"} aria-label={`${locale === "id" ? "Edit profil" : "Edit profile"}: ${profile.displayName}`} href={`/admin/profiles/${profile.id}/edit` as Route}><ExternalLink size={15} aria-hidden="true" /></Link></td>
                  </tr>
                ))}
                {!dashboard.recentProfiles.length ? <tr><td colSpan={3}>{copy.noData}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="content-panel">
          <div className="panel-header"><div><h2>{copy.topProfiles}</h2></div></div>
          <div className="table-scroll">
            <table className="data-table compact-table">
              <thead><tr><th>{copy.profile}</th><th>{copy.totalEvents}</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {dashboard.topProfiles.map((profile) => (
                  <tr key={profile.id}>
                    <td><span className="entity-name">{profile.displayName}</span><span className="entity-meta">{profile.companyName}</span></td>
                    <td><strong>{profile.total}</strong></td>
                    <td><Link className="icon-button" title={locale === "id" ? "Lihat publik" : "View public"} aria-label={`${locale === "id" ? "Lihat publik" : "View public"}: ${profile.displayName}`} href={`/c/${profile.slug}` as Route} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /></Link></td>
                  </tr>
                ))}
                {!dashboard.topProfiles.length ? <tr><td colSpan={3}>{copy.noData}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

