import { Activity, Download, Filter, UsersRound } from "lucide-react";
import { UserRole, type ActivityEventType } from "@/generated/prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "@/i18n/server";
import { phase6Messages } from "@/i18n/phase6-messages";
import {
  ANALYTICS_EVENT_TYPES,
  getAnalyticsReport,
  parseAnalyticsFilters,
  resolveAnalyticsScope,
} from "@/services/analytics.service";
import { resolveSelectedCompany } from "@/services/authorization.service";
import { getSessionFromCookies } from "@/services/auth.service";

export const metadata: Metadata = { title: "Analytics" };

type SearchInput = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<SearchInput> };

function eventLabels(locale: "id" | "en"): Record<ActivityEventType, string> {
  return locale === "en"
    ? { PROFILE_VIEW: "Profile views", VCARD_DOWNLOAD: "vCard downloads", PHONE_CLICK: "Phone clicks", WHATSAPP_CLICK: "WhatsApp clicks", EMAIL_CLICK: "Email clicks", SOCIAL_CLICK: "Social clicks", SHARE_CLICK: "Share clicks" }
    : { PROFILE_VIEW: "Kunjungan profil", VCARD_DOWNLOAD: "Download vCard", PHONE_CLICK: "Klik telepon", WHATSAPP_CLICK: "Klik WhatsApp", EMAIL_CLICK: "Klik email", SOCIAL_CLICK: "Klik media sosial", SHARE_CLICK: "Klik bagikan" };
}

function hrefWithPage(query: SearchInput, page: number): Route {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar && key !== "page") params.set(key, scalar);
  }
  params.set("page", String(page));
  return `/admin/analytics?${params.toString()}` as Route;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  const [locale, selectedCompany, query] = await Promise.all([
    getLocale(),
    resolveSelectedCompany(session),
    searchParams,
  ]);
  const copy = phase6Messages(locale);
  const labels = eventLabels(locale);
  const requestedScope = Array.isArray(query.scope) ? query.scope[0] : query.scope;
  const scope = resolveAnalyticsScope(
    session,
    selectedCompany,
    session.user.role === UserRole.SUPER_ADMIN ? requestedScope : undefined,
  );
  const filters = parseAnalyticsFilters(query);
  const report = await getAnalyticsReport(scope, filters);
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar && key !== "page") exportParams.set(key, scalar);
  }

  return (
    <>
      <div className="page-header">
        <div><h1>{copy.analyticsTitle}</h1><p>{copy.analyticsSubtitle}</p></div>
        <a className="button button-secondary" href={`/api/admin/analytics/export?${exportParams.toString()}`}><Download size={16} aria-hidden="true" />{copy.exportCsv}</a>
      </div>
      <p className="scope-caption">{scope.label}</p>

      <section className="content-panel analytics-filter-panel" aria-labelledby="analytics-filter-title">
        <div className="panel-header"><div><h2 id="analytics-filter-title"><Filter size={17} aria-hidden="true" />{copy.filters}</h2></div></div>
        <form className="analytics-filter-grid" method="get">
          {scope.kind === "global" ? <input type="hidden" name="scope" value="global" /> : null}
          <label><span>{copy.from}</span><input type="date" name="from" defaultValue={filters.fromInput} /></label>
          <label><span>{copy.to}</span><input type="date" name="to" defaultValue={filters.toInput} /></label>
          <label><span>{copy.eventType}</span><select name="eventType" defaultValue={filters.eventType ?? ""}><option value="">{copy.allEvents}</option>{ANALYTICS_EVENT_TYPES.map((eventType) => <option value={eventType} key={eventType}>{labels[eventType]}</option>)}</select></label>
          <label><span>{copy.profile}</span><select name="profileId" defaultValue={filters.profileId ?? ""}><option value="">{copy.allProfiles}</option>{report.availableProfiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.displayName} · {profile.company.name}</option>)}</select></label>
          <div className="filter-actions"><button className="button button-primary" type="submit">{copy.apply}</button><Link className="button button-secondary" href={(scope.kind === "global" ? "/admin/analytics?scope=global" : "/admin/analytics") as Route}>{copy.reset}</Link></div>
        </form>
      </section>

      <section className="summary-row analytics-summary" aria-label="Analytics totals">
        <div className="summary-item"><Activity size={20} aria-hidden="true" /><p className="summary-label">{copy.totalEvents}</p><strong className="summary-value">{report.totalEvents}</strong></div>
        <div className="summary-item"><UsersRound size={20} aria-hidden="true" /><p className="summary-label">{copy.profilesWithEvents}</p><strong className="summary-value">{report.pagination.totalRows}</strong></div>
        <div className="summary-item analytics-period"><p className="summary-label">{copy.period}</p><strong>{filters.fromInput}</strong><span>—</span><strong>{filters.toInput}</strong></div>
      </section>

      <div className="metric-definition"><strong>{copy.metricDefinition}</strong><p>{copy.metricDefinitionText}</p></div>

      <section className="content-panel analytics-table-panel">
        <div className="table-scroll">
          <table className="data-table analytics-table">
            <thead><tr><th>{copy.profile}</th>{ANALYTICS_EVENT_TYPES.map((eventType) => <th key={eventType}>{labels[eventType]}</th>)}<th>{copy.totalEvents}</th></tr></thead>
            <tbody>
              {report.rows.map((row) => <tr key={row.profileId}><td><span className="entity-name">{row.displayName}</span><span className="entity-meta">{row.companyName} · /{row.slug}</span></td>{ANALYTICS_EVENT_TYPES.map((eventType) => <td key={eventType}>{row.counts[eventType]}</td>)}<td><strong>{row.total}</strong></td></tr>)}
              {!report.rows.length ? <tr><td colSpan={ANALYTICS_EVENT_TYPES.length + 2}>{copy.noData}</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="profile-pagination"><span>{report.pagination.totalRows} {copy.results} · {copy.page} {report.pagination.page} {copy.of} {report.pagination.totalPages}</span><div><Link aria-disabled={report.pagination.page <= 1} className={`button button-secondary button-sm${report.pagination.page <= 1 ? " is-disabled" : ""}`} href={hrefWithPage(query, Math.max(1, report.pagination.page - 1))}>{copy.previous}</Link><Link aria-disabled={report.pagination.page >= report.pagination.totalPages} className={`button button-secondary button-sm${report.pagination.page >= report.pagination.totalPages ? " is-disabled" : ""}`} href={hrefWithPage(query, Math.min(report.pagination.totalPages, report.pagination.page + 1))}>{copy.next}</Link></div></div>
      </section>
    </>
  );
}

