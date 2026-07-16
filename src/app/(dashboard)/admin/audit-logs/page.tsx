import { Filter, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "@/i18n/server";
import { phase6Messages } from "@/i18n/phase6-messages";
import {
  listAuditLogs,
  parseAuditFilters,
} from "@/services/audit.service";
import { getSessionFromCookies } from "@/services/auth.service";

export const metadata: Metadata = { title: "Audit Logs" };

type SearchInput = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<SearchInput> };

function hrefWithPage(query: SearchInput, page: number): Route {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar && key !== "page") params.set(key, scalar);
  }
  params.set("page", String(page));
  return `/admin/audit-logs?${params.toString()}` as Route;
}

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");
  const [locale, query] = await Promise.all([getLocale(), searchParams]);
  const copy = phase6Messages(locale);
  const filters = parseAuditFilters(query);
  const result = await listAuditLogs(session, filters);
  const formatter = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });

  return (
    <>
      <div className="page-header"><div><h1>{copy.auditTitle}</h1><p>{copy.auditSubtitle}</p></div></div>

      <section className="content-panel analytics-filter-panel" aria-labelledby="audit-filter-title">
        <div className="panel-header"><div><h2 id="audit-filter-title"><Filter size={17} aria-hidden="true" />{copy.filters}</h2></div></div>
        <form className="audit-filter-grid" method="get">
          <label className="search-field"><span>{copy.search}</span><span className="input-with-icon"><Search size={16} aria-hidden="true" /><input name="search" defaultValue={filters.search ?? ""} maxLength={100} /></span></label>
          <label><span>{copy.action}</span><select name="action" defaultValue={filters.action ?? ""}><option value="">{copy.all}</option>{result.options.actions.map((action) => <option value={action} key={action}>{action}</option>)}</select></label>
          <label><span>{copy.entity}</span><select name="entityType" defaultValue={filters.entityType ?? ""}><option value="">{copy.all}</option>{result.options.entityTypes.map((entity) => <option value={entity} key={entity}>{entity}</option>)}</select></label>
          <label><span>{copy.company}</span><select name="companyId" defaultValue={filters.companyId ?? ""}><option value="">{copy.all}</option>{result.options.companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>
          <label><span>{copy.from}</span><input type="date" name="from" defaultValue={filters.fromInput ?? ""} /></label>
          <label><span>{copy.to}</span><input type="date" name="to" defaultValue={filters.toInput ?? ""} /></label>
          <div className="filter-actions"><button className="button button-primary" type="submit">{copy.apply}</button><Link className="button button-secondary" href={"/admin/audit-logs" as Route}>{copy.reset}</Link></div>
        </form>
      </section>

      <section className="content-panel audit-table-panel">
        <div className="table-scroll">
          <table className="data-table audit-table">
            <thead><tr><th>{copy.time}</th><th>{copy.actor}</th><th>{copy.action}</th><th>{copy.entity}</th><th>{copy.company}</th><th>{copy.changes}</th></tr></thead>
            <tbody>
              {result.logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatter.format(log.createdAt)}</td>
                  <td><span className="entity-name">{log.user.name}</span><span className="entity-meta">@{log.user.username}</span></td>
                  <td><code className="audit-action">{log.action}</code></td>
                  <td><span className="entity-name">{log.entityType}</span>{log.entityId ? <span className="entity-meta">{log.entityId}</span> : null}</td>
                  <td>{log.company?.name ?? "—"}</td>
                  <td>
                    {log.oldValues || log.newValues ? (
                      <details className="audit-details">
                        <summary>{copy.showChanges}</summary>
                        <div className="audit-change-grid">
                          <div><strong>{copy.oldValue}</strong><pre>{log.oldValues ?? "—"}</pre></div>
                          <div><strong>{copy.newValue}</strong><pre>{log.newValues ?? "—"}</pre></div>
                        </div>
                      </details>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {!result.logs.length ? <tr><td colSpan={6}>{copy.noAudit}</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="profile-pagination"><span>{result.pagination.totalRows} {copy.results} · {copy.page} {result.pagination.page} {copy.of} {result.pagination.totalPages}</span><div><Link aria-disabled={result.pagination.page <= 1} className={`button button-secondary button-sm${result.pagination.page <= 1 ? " is-disabled" : ""}`} href={hrefWithPage(query, Math.max(1, result.pagination.page - 1))}>{copy.previous}</Link><Link aria-disabled={result.pagination.page >= result.pagination.totalPages} className={`button button-secondary button-sm${result.pagination.page >= result.pagination.totalPages ? " is-disabled" : ""}`} href={hrefWithPage(query, Math.min(result.pagination.totalPages, result.pagination.page + 1))}>{copy.next}</Link></div></div>
      </section>
    </>
  );
}

