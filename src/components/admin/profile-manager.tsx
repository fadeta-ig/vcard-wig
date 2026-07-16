"use client";

import {
  Archive,
  ExternalLink,
  EyeOff,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileStatusBadge } from "@/components/ui/profile-status-badge";
import type { Locale } from "@/i18n/messages";
import { profileMessages } from "@/i18n/profile-messages";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { ProfileStatusValue } from "@/lib/profile-options";
import type { ProfileListResultView } from "@/lib/profile-types";

type QueryState = {
  page: number;
  pageSize: number;
  search: string;
  status?: ProfileStatusValue;
  department?: string;
  createdFrom?: string;
  createdTo?: string;
  sort: string;
};

function statusLabel(status: ProfileStatusValue, copy: ReturnType<typeof profileMessages>) {
  return {
    DRAFT: copy.draft,
    ACTIVE: copy.active,
    INACTIVE: copy.inactive,
    ARCHIVED: copy.archived,
  }[status];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiClientError)) return fallback;
  const firstFieldError = error.fields
    ? Object.values(error.fields).flat().find(Boolean)
    : undefined;
  return firstFieldError ?? error.message;
}

export function ProfileManager({
  initialResult,
  locale,
  company,
  query,
}: {
  initialResult: ProfileListResultView;
  locale: Locale;
  company: { id: string; name: string } | null;
  query: QueryState;
}) {
  const copy = profileMessages(locale);
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parameters = new URLSearchParams();
    for (const key of ["search", "status", "department", "createdFrom", "createdTo", "sort", "pageSize"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) parameters.set(key, value);
    }
    router.push(`/admin/profiles?${parameters.toString()}`);
  }

  async function changeStatus(profileId: string, status: ProfileStatusValue) {
    if (status === "ARCHIVED" && !window.confirm(copy.archiveConfirm)) return;
    setPendingId(profileId);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/admin/profiles/${profileId}/status`, {
        method: "POST",
        body: { status },
      });
      setMessage(copy.statusChanged);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, copy.empty));
    } finally {
      setPendingId(null);
    }
  }

  const result = initialResult;
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{copy.title}</h1>
          <p>{company ? `${copy.subtitle} ${company.name}.` : copy.companyRequired}</p>
        </div>
        {company ? (
          <Link className="button button-primary" href={"/admin/profiles/new" as Route}>
            <Plus size={17} aria-hidden="true" />
            {copy.add}
          </Link>
        ) : null}
      </div>

      {message ? <div className="alert alert-success profile-alert" role="status">{message}</div> : null}
      {error ? <div className="alert alert-error profile-alert" role="alert">{error}</div> : null}

      <section className="profile-summary" aria-label={copy.title}>
        {([
          [copy.records, result.summary.total],
          [copy.draft, result.summary.draft],
          [copy.active, result.summary.active],
          [copy.inactive, result.summary.inactive],
          [copy.archived, result.summary.archived],
        ] as const).map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <form className="profile-filters" onSubmit={applyFilters}>
        <div className="field profile-search-field">
          <label htmlFor="profile-search">{copy.search}</label>
          <div className="input-with-icon">
            <Search size={16} aria-hidden="true" />
            <input id="profile-search" name="search" defaultValue={query.search} placeholder={copy.search} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="profile-status-filter">{copy.status}</label>
          <select id="profile-status-filter" name="status" defaultValue={query.status ?? ""}>
            <option value="">{copy.allStatuses}</option>
            <option value="DRAFT">{copy.draft}</option>
            <option value="ACTIVE">{copy.active}</option>
            <option value="INACTIVE">{copy.inactive}</option>
            <option value="ARCHIVED">{copy.archived}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="profile-department-filter">{copy.department}</label>
          <select id="profile-department-filter" name="department" defaultValue={query.department ?? ""}>
            <option value="">{copy.allDepartments}</option>
            {result.filters.departments.map((department) => <option key={department}>{department}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="profile-sort">{copy.sort}</label>
          <select id="profile-sort" name="sort" defaultValue={query.sort}>
            <option value="newest">{copy.newest}</option>
            <option value="oldest">{copy.oldest}</option>
            <option value="name_asc">{copy.nameAsc}</option>
            <option value="most_viewed">{copy.mostViewed}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="profile-created-from">{locale === "id" ? "Dibuat mulai" : "Created from"}</label>
          <input id="profile-created-from" name="createdFrom" type="date" defaultValue={query.createdFrom ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="profile-created-to">{locale === "id" ? "Sampai" : "Created to"}</label>
          <input id="profile-created-to" name="createdTo" type="date" defaultValue={query.createdTo ?? ""} />
        </div>
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <div className="profile-filter-actions">
          <button className="button button-primary" type="submit">{copy.filter}</button>
          <Link className="button button-secondary" href="/admin/profiles">{copy.reset}</Link>
        </div>
      </form>

      {!company || result.items.length === 0 ? (
        <EmptyState title={company ? copy.empty : copy.companyRequired}>
          {company ? <Link className="button button-secondary" href={"/admin/profiles/new" as Route}><Plus size={16} />{copy.add}</Link> : null}
        </EmptyState>
      ) : (
        <section className="content-panel">
          <div className="table-scroll">
            <table className="data-table profile-table">
              <thead><tr><th>{copy.profile}</th><th>{copy.job}</th><th>{copy.status}</th><th>{copy.socials}</th><th>{copy.updated}</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {result.items.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <div className="entity-cell">
                        <span className="profile-list-avatar">
                          {profile.profileThumbnail ? <Image src={profile.profileThumbnail} alt="" width={42} height={42} unoptimized /> : initials(profile.displayName)}
                        </span>
                        <span><span className="entity-name">{profile.displayName}</span><span className="entity-meta">{profile.email} · /{profile.slug}</span></span>
                      </div>
                    </td>
                    <td><span className="entity-name">{profile.jobTitle}</span><span className="entity-meta">{profile.department ?? "—"}</span></td>
                    <td><ProfileStatusBadge status={profile.status} label={statusLabel(profile.status, copy)} /></td>
                    <td>{profile._count.socialLinks}</td>
                    <td>{new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(profile.updatedAt))}</td>
                    <td>
                      <div className="table-actions profile-row-actions">
                        <Link className="button button-secondary button-sm" href={`/admin/profiles/${profile.id}/edit` as Route}><Pencil size={14} />{copy.edit}</Link>
                        {profile.status !== "ARCHIVED" ? (
                          <Link
                            aria-label={`${copy.qrVcard}: ${profile.displayName}`}
                            className="icon-button"
                            href={`/admin/profiles/${profile.id}/qr` as Route}
                            title={copy.qrVcard}
                          >
                            <QrCode aria-hidden="true" size={17} />
                          </Link>
                        ) : null}
                        {profile.status === "ACTIVE" || profile.status === "INACTIVE" ? (
                          <Link
                            aria-label={`${copy.viewPublic}: ${profile.displayName}`}
                            className="icon-button"
                            href={`/c/${profile.slug}` as Route}
                            rel="noreferrer"
                            target="_blank"
                            title={copy.viewPublic}
                          >
                            <ExternalLink aria-hidden="true" size={17} />
                          </Link>
                        ) : null}
                        {profile.status === "DRAFT" || profile.status === "INACTIVE" ? <button className="icon-button" title={copy.publish} aria-label={copy.publish} disabled={pendingId === profile.id} onClick={() => changeStatus(profile.id, "ACTIVE")}><Send size={16} /></button> : null}
                        {profile.status === "ACTIVE" ? <button className="icon-button" title={copy.deactivate} aria-label={copy.deactivate} disabled={pendingId === profile.id} onClick={() => changeStatus(profile.id, "INACTIVE")}><EyeOff size={16} /></button> : null}
                        {profile.status === "ARCHIVED" ? <button className="icon-button" title={copy.restore} aria-label={copy.restore} disabled={pendingId === profile.id} onClick={() => changeStatus(profile.id, "DRAFT")}><RotateCcw size={16} /></button> : <button className="icon-button danger-icon" title={copy.archive} aria-label={copy.archive} disabled={pendingId === profile.id} onClick={() => changeStatus(profile.id, "ARCHIVED")}><Archive size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="profile-pagination">
            <span>{copy.showing} {result.items.length} {copy.records} · {copy.page} {result.pagination.page} {copy.of} {result.pagination.totalPages}</span>
            <div>
              <button className="button button-secondary button-sm" type="button" disabled={result.pagination.page <= 1} onClick={() => { const params = new URLSearchParams(window.location.search); params.set("page", String(result.pagination.page - 1)); router.push(`/admin/profiles?${params}`); }}>{copy.previous}</button>
              <button className="button button-secondary button-sm" type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => { const params = new URLSearchParams(window.location.search); params.set("page", String(result.pagination.page + 1)); router.push(`/admin/profiles?${params}`); }}>{copy.next}</button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
