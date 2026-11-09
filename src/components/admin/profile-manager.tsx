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
  Trash2,
  MoreHorizontal,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { DeleteProfileDialog } from "@/components/admin/delete-profile-dialog";
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

function statusLabel(
  status: ProfileStatusValue,
  copy: ReturnType<typeof profileMessages>,
) {
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
  const [filterPending, startFilterTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<
    ProfileListResultView["items"][number] | null
  >(null);
  const [deleting, setDeleting] = useState<
    ProfileListResultView["items"][number] | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parameters = new URLSearchParams();
    for (const key of [
      "search",
      "status",
      "department",
      "createdFrom",
      "createdTo",
      "sort",
      "pageSize",
    ]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) parameters.set(key, value);
    }
    startFilterTransition(() =>
      router.push(`/admin/profiles?${parameters.toString()}`),
    );
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
        profileContext: {
          companyId: company!.id,
          version: initialResult.items.find(
            (profile) => profile.id === profileId,
          )!.version,
        },
      });
      setMessage(copy.statusChanged);
      setActionTarget(null);
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
          <p>
            {company
              ? `${copy.subtitle} ${company.name}.`
              : copy.companyRequired}
          </p>
        </div>
        {company ? (
          <Link
            className="button button-primary"
            href={"/admin/profiles/new" as Route}
          >
            <Plus size={17} aria-hidden="true" />
            {copy.add}
          </Link>
        ) : null}
      </div>

      {message ? (
        <div className="alert alert-success profile-alert" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="alert alert-error profile-alert" role="alert">
          {error}
        </div>
      ) : null}

      <section className="profile-summary" aria-label={copy.title}>
        {(
          [
            [copy.records, result.summary.total],
            [copy.draft, result.summary.draft],
            [copy.active, result.summary.active],
            [copy.inactive, result.summary.inactive],
            [copy.archived, result.summary.archived],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <form
        className="profile-filters"
        onSubmit={applyFilters}
        aria-busy={filterPending}
      >
        <div className="field profile-search-field">
          <label htmlFor="profile-search">{copy.search}</label>
          <div className="input-with-icon">
            <Search size={16} aria-hidden="true" />
            <input
              id="profile-search"
              name="search"
              defaultValue={query.search}
              placeholder={copy.search}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="profile-status-filter">{copy.status}</label>
          <select
            id="profile-status-filter"
            name="status"
            defaultValue={query.status ?? ""}
          >
            <option value="">{copy.allStatuses}</option>
            <option value="DRAFT">{copy.draft}</option>
            <option value="ACTIVE">{copy.active}</option>
            <option value="INACTIVE">{copy.inactive}</option>
            <option value="ARCHIVED">{copy.archived}</option>
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
        <details
          className="profile-advanced-filters"
          open={Boolean(
            query.department || query.createdFrom || query.createdTo,
          )}
        >
          <summary>
            {locale === "id" ? "Filter lanjutan" : "Advanced filters"}
          </summary>
          <div className="form-grid">
            {" "}
            <div className="field">
              <label htmlFor="profile-department-filter">
                {copy.department}
              </label>
              <select
                id="profile-department-filter"
                name="department"
                defaultValue={query.department ?? ""}
              >
                <option value="">{copy.allDepartments}</option>
                {result.filters.departments.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="profile-created-from">
                {locale === "id" ? "Dibuat mulai" : "Created from"}
              </label>
              <input
                id="profile-created-from"
                name="createdFrom"
                type="date"
                defaultValue={query.createdFrom ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-created-to">
                {locale === "id" ? "Sampai" : "Created to"}
              </label>
              <input
                id="profile-created-to"
                name="createdTo"
                type="date"
                defaultValue={query.createdTo ?? ""}
              />
            </div>
          </div>
        </details>
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <div className="profile-filter-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={filterPending}
          >
            {filterPending
              ? locale === "id"
                ? "Memuat…"
                : "Loading…"
              : copy.filter}
          </button>
          <Link className="button button-secondary" href="/admin/profiles">
            {copy.reset}
          </Link>
        </div>
      </form>

      {!company || result.items.length === 0 ? (
        <EmptyState
          title={
            company
              ? query.search ||
                query.status ||
                query.department ||
                query.createdFrom ||
                query.createdTo
                ? locale === "id"
                  ? "Tidak ada profil yang sesuai filter"
                  : "No profiles match your filters"
                : copy.empty
              : copy.companyRequired
          }
        >
          {company ? (
            query.search ||
            query.status ||
            query.department ||
            query.createdFrom ||
            query.createdTo ? (
              <Link className="button button-secondary" href="/admin/profiles">
                {copy.reset}
              </Link>
            ) : (
              <Link
                className="button button-secondary"
                href={"/admin/profiles/new" as Route}
              >
                <Plus size={16} />
                {copy.add}
              </Link>
            )
          ) : null}
        </EmptyState>
      ) : (
        <section className="content-panel">
          <div className="table-scroll">
            <table className="data-table profile-table">
              <thead>
                <tr>
                  <th>{copy.profile}</th>
                  <th>{copy.job}</th>
                  <th>{copy.status}</th>
                  <th>{copy.socials}</th>
                  <th>{copy.updated}</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <div className="entity-cell">
                        <span className="profile-list-avatar">
                          {profile.profileThumbnail ? (
                            <Image
                              src={profile.profileThumbnail}
                              alt=""
                              width={42}
                              height={42}
                              unoptimized
                            />
                          ) : (
                            initials(profile.displayName)
                          )}
                        </span>
                        <span>
                          <Link
                            className="entity-name profile-name-link"
                            href={`/admin/profiles/${profile.id}/edit` as Route}
                          >
                            {profile.displayName}
                          </Link>
                          <span className="entity-meta">
                            {profile.email} · /{profile.slug}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="entity-name">{profile.jobTitle}</span>
                      <span className="entity-meta">
                        {profile.department ?? "—"}
                      </span>
                    </td>
                    <td>
                      <ProfileStatusBadge
                        status={profile.status}
                        label={statusLabel(profile.status, copy)}
                      />
                    </td>
                    <td>{profile._count.socialLinks}</td>
                    <td>
                      {new Intl.DateTimeFormat(
                        locale === "id" ? "id-ID" : "en-US",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Jakarta",
                        },
                      ).format(new Date(profile.updatedAt))}
                    </td>
                    <td>
                      <div className="table-actions profile-row-actions">
                        <Link
                          className="button button-secondary button-sm"
                          href={`/admin/profiles/${profile.id}/edit` as Route}
                        >
                          <Pencil size={14} />
                          {copy.edit}
                        </Link>
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
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`${locale === "id" ? "Tindakan lainnya" : "More actions"}: ${profile.displayName}`}
                          title={
                            locale === "id"
                              ? "Tindakan lainnya"
                              : "More actions"
                          }
                          onClick={() => {
                            setError(null);
                            setActionTarget(profile);
                          }}
                        >
                          <MoreHorizontal size={19} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="profile-pagination">
            <span>
              {copy.showing} {result.items.length} {copy.records} · {copy.page}{" "}
              {result.pagination.page} {copy.of} {result.pagination.totalPages}
            </span>
            <div>
              <button
                className="button button-secondary button-sm"
                type="button"
                disabled={result.pagination.page <= 1}
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("page", String(result.pagination.page - 1));
                  router.push(`/admin/profiles?${params}`);
                }}
              >
                {copy.previous}
              </button>
              <button
                className="button button-secondary button-sm"
                type="button"
                disabled={
                  result.pagination.page >= result.pagination.totalPages
                }
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("page", String(result.pagination.page + 1));
                  router.push(`/admin/profiles?${params}`);
                }}
              >
                {copy.next}
              </button>
            </div>
          </div>
        </section>
      )}
      {actionTarget ? (
        <ModalDialog
          titleId="profile-actions-title"
          className="modal modal-sm"
          onClose={() => setActionTarget(null)}
          pending={pendingId === actionTarget.id}
        >
          <div className="modal-header">
            <div>
              <h2 id="profile-actions-title">{actionTarget.displayName}</h2>
              <p>/{actionTarget.slug}</p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label={locale === "id" ? "Tutup" : "Close"}
              onClick={() => setActionTarget(null)}
              disabled={pendingId === actionTarget.id}
            >
              <X size={18} />
            </button>
          </div>
          <div className="modal-body profile-action-list">
            {error ? (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            ) : null}
            {actionTarget.status === "ACTIVE" ||
            actionTarget.status === "INACTIVE" ? (
              <Link
                className="button button-secondary"
                href={`/c/${actionTarget.slug}` as Route}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} />
                {copy.viewPublic}
              </Link>
            ) : null}
            {actionTarget.status === "DRAFT" ||
            actionTarget.status === "INACTIVE" ? (
              <button
                className="button button-secondary"
                type="button"
                disabled={pendingId === actionTarget.id}
                onClick={() => changeStatus(actionTarget.id, "ACTIVE")}
              >
                <Send size={16} />
                {copy.publish}
              </button>
            ) : null}
            {actionTarget.status === "ACTIVE" ? (
              <button
                className="button button-secondary"
                type="button"
                disabled={pendingId === actionTarget.id}
                onClick={() => changeStatus(actionTarget.id, "INACTIVE")}
              >
                <EyeOff size={16} />
                {copy.deactivate}
              </button>
            ) : null}
            {actionTarget.status === "ARCHIVED" ? (
              <>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={pendingId === actionTarget.id}
                  onClick={() => changeStatus(actionTarget.id, "DRAFT")}
                >
                  <RotateCcw size={16} />
                  {copy.restore}
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  disabled={pendingId === actionTarget.id}
                  onClick={() => {
                    setDeleting(actionTarget);
                    setActionTarget(null);
                  }}
                >
                  <Trash2 size={16} />
                  {locale === "id" ? "Hapus permanen" : "Delete permanently"}
                </button>
              </>
            ) : (
              <button
                className="button button-danger"
                type="button"
                disabled={pendingId === actionTarget.id}
                onClick={() => changeStatus(actionTarget.id, "ARCHIVED")}
              >
                <Archive size={16} />
                {copy.archive}
              </button>
            )}
          </div>
        </ModalDialog>
      ) : null}
      {deleting && company ? (
        <DeleteProfileDialog
          profile={deleting}
          companyId={company.id}
          locale={locale}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setMessage(
              locale === "id"
                ? "Profil arsip telah dihapus permanen."
                : "Archived profile permanently deleted.",
            );
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
