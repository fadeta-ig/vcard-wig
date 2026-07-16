"use client";

import { KeyRound, Pencil, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { translate } from "@/i18n/messages";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

type CompanyOption = { id: string; name: string; slug: string; isActive: boolean };

export type AdminView = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: "SUPER_ADMIN" | "ADMIN";
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberships: Array<{ company: CompanyOption }>;
};

function sortAdmins(admins: AdminView[]): AdminView[] {
  return [...admins].sort(
    (left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name),
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AdminManager({
  initialAdmins,
  companies,
  currentUsername,
  locale,
}: {
  initialAdmins: AdminView[];
  companies: CompanyOption[];
  currentUsername: string;
  locale: Locale;
}) {
  const [admins, setAdmins] = useState(() => sortAdmins(initialAdmins));
  const [editing, setEditing] = useState<AdminView | "new" | null>(null);
  const [resetting, setResetting] = useState<AdminView | null>(null);
  const [selectedRole, setSelectedRole] = useState<"SUPER_ADMIN" | "ADMIN">("ADMIN");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const admin = editing === "new" ? null : editing;

  function openCreate() {
    setSelectedRole("ADMIN");
    setError(null);
    setEditing("new");
  }

  function openEdit(value: AdminView) {
    setSelectedRole(value.role);
    setError(null);
    setEditing(value);
  }

  function upsertAdmin(value: AdminView) {
    setAdmins((current) => sortAdmins([...current.filter((item) => item.id !== value.id), value]));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const companyIds = form.getAll("companyIds").map(String);
    const email = String(form.get("email") ?? "").trim();
    const input = admin
      ? {
          name: form.get("name"),
          ...(email ? { email } : {}),
          role: form.get("role"),
          ...(admin.username === currentUsername ? {} : { isActive: form.has("isActive") }),
          companyIds,
        }
      : {
          username: form.get("username"),
          name: form.get("name"),
          email,
          password: form.get("password"),
          role: form.get("role"),
          companyIds,
        };

    try {
      const result = await apiRequest<AdminView>(
        admin ? `/api/admin/admins/${admin.id}` : "/api/admin/admins",
        { method: admin ? "PATCH" : "POST", body: input },
      );
      upsertAdmin(result);
      setEditing(null);
      setMessage(translate(locale, admin ? "admin.updated" : "admin.created"));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : translate(locale, "common.error"));
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetting) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest(`/api/admin/admins/${resetting.id}/reset-password`, {
        method: "POST",
        body: {
          password: form.get("password"),
          confirmation: form.get("confirmation"),
        },
      });
      upsertAdmin({ ...resetting, mustChangePassword: true });
      setResetting(null);
      setMessage(translate(locale, "admin.passwordReset"));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : translate(locale, "common.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{translate(locale, "admin.title")}</h1>
          <p>{translate(locale, "admin.subtitle")}</p>
        </div>
        <button className="button button-primary" type="button" onClick={openCreate} disabled={companies.length === 0}>
          <Plus size={17} aria-hidden="true" />
          {translate(locale, "admin.add")}
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="alert alert-warning" role="status" style={{ marginBottom: 18 }}>
          {locale === "id"
            ? "Buat perusahaan terlebih dahulu sebelum membuat akun Admin."
            : "Create a company before adding an Admin account."}
        </div>
      ) : null}
      {message ? <div className="alert alert-success" role="status" style={{ marginBottom: 18 }}>{message}</div> : null}
      {error && !editing && !resetting ? <div className="alert alert-error" role="alert" style={{ marginBottom: 18 }}>{error}</div> : null}

      {admins.length === 0 ? (
        <EmptyState title={translate(locale, "admin.empty")} />
      ) : (
        <section className="content-panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translate(locale, "admin.name")}</th>
                  <th>{translate(locale, "admin.role")}</th>
                  <th>{translate(locale, "admin.companies")}</th>
                  <th>Status</th>
                  <th><span className="sr-only">{translate(locale, "common.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {admins.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="entity-cell">
                        <span className="entity-logo">{initials(item.name)}</span>
                        <span>
                          <span className="entity-name">
                            {item.name}{item.username === currentUsername ? (locale === "id" ? " (Anda)" : " (You)") : ""}
                          </span>
                          <span className="entity-meta">@{item.username} · {item.email ?? "—"}</span>
                        </span>
                      </div>
                    </td>
                    <td>{item.role.replace("_", " ")}</td>
                    <td>
                      {item.role === "SUPER_ADMIN"
                        ? (locale === "id" ? "Semua perusahaan" : "All companies")
                        : item.memberships.map((membership) => membership.company.name).join(", ") || "—"}
                    </td>
                    <td>
                      <StatusBadge
                        active={item.isActive}
                        activeLabel={translate(locale, "common.active")}
                        inactiveLabel={translate(locale, "common.inactive")}
                      />
                      {item.mustChangePassword ? (
                        <span className="entity-meta">
                          {locale === "id" ? "Wajib mengganti password" : "Password change required"}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <div className="table-actions">
                        {item.username !== currentUsername ? (
                          <button className="icon-button" type="button" onClick={() => { setError(null); setResetting(item); }} aria-label={translate(locale, "admin.resetPassword")}>
                            <KeyRound size={16} aria-hidden="true" />
                          </button>
                        ) : null}
                        <button className="button button-secondary button-sm" type="button" onClick={() => openEdit(item)}>
                          <Pencil size={14} aria-hidden="true" />
                          {translate(locale, "common.edit")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="admin-modal-title">{admin ? translate(locale, "admin.edit") : translate(locale, "admin.add")}</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>{admin?.username ? `@${admin.username}` : translate(locale, "admin.subtitle")}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label={translate(locale, "common.close")}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body form-grid">
                {error ? <div className="alert alert-error form-span-2" role="alert">{error}</div> : null}
                {!admin ? (
                  <div className="field form-span-2">
                    <label htmlFor="admin-username">{translate(locale, "admin.username")}</label>
                    <input id="admin-username" name="username" minLength={3} maxLength={64} pattern="[a-z0-9._-]+" autoCapitalize="none" required />
                  </div>
                ) : null}
                <div className="field form-span-2">
                  <label htmlFor="admin-name">{translate(locale, "admin.name")}</label>
                  <input id="admin-name" name="name" defaultValue={admin?.name ?? ""} minLength={2} maxLength={100} required />
                </div>
                <div className="field form-span-2">
                  <label htmlFor="admin-email">{translate(locale, "admin.email")}</label>
                  <input
                    id="admin-email"
                    name="email"
                    type="email"
                    defaultValue={admin?.email ?? ""}
                    maxLength={191}
                    required={!admin || Boolean(admin.email)}
                  />
                </div>
                {!admin ? (
                  <div className="field form-span-2">
                    <label htmlFor="admin-password">{translate(locale, "admin.temporaryPassword")}</label>
                    <input id="admin-password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
                    <p className="field-hint">
                      {locale === "id"
                        ? "Minimal 12 karakter; wajib diganti saat login pertama."
                        : "Minimum 12 characters; change is required at first login."}
                    </p>
                  </div>
                ) : null}
                <div className="field form-span-2">
                  <label htmlFor="admin-role">{translate(locale, "admin.role")}</label>
                  <select
                    id="admin-role"
                    name="role"
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as "SUPER_ADMIN" | "ADMIN")}
                    disabled={admin?.username === currentUsername}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER ADMIN</option>
                  </select>
                  {admin?.username === currentUsername ? <input type="hidden" name="role" value={admin.role} /> : null}
                </div>
                {selectedRole === "ADMIN" ? (
                  <fieldset className="field form-span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="field-label">{translate(locale, "admin.companies")}</legend>
                    <div className="company-checklist">
                      {companies.map((company) => (
                        <label className="checkbox-field" key={company.id}>
                          <input
                            type="checkbox"
                            name="companyIds"
                            value={company.id}
                            defaultChecked={admin?.memberships.some((membership) => membership.company.id === company.id)}
                          />
                          <span>{company.name}{!company.isActive ? " (Inactive)" : ""}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {admin ? (
                  <label className="checkbox-field form-span-2">
                    <input name="isActive" type="checkbox" defaultChecked={admin.isActive} disabled={admin.username === currentUsername} />
                    <span>{translate(locale, "common.active")}</span>
                  </label>
                ) : null}
              </div>
              <div className="modal-footer">
                <button className="button button-secondary" type="button" onClick={() => setEditing(null)} disabled={pending}>{translate(locale, "common.cancel")}</button>
                <button className="button button-primary" type="submit" disabled={pending}>{translate(locale, admin ? "common.update" : "common.create")}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {resetting ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="reset-modal-title">{translate(locale, "admin.resetPassword")}</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>@{resetting.username}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setResetting(null)} aria-label={translate(locale, "common.close")}><X size={18} /></button>
            </div>
            <form onSubmit={resetPassword}>
              <div className="modal-body form-grid">
                {error ? <div className="alert alert-error form-span-2" role="alert">{error}</div> : null}
                <div className="field form-span-2">
                  <label htmlFor="reset-password">{translate(locale, "admin.temporaryPassword")}</label>
                  <input id="reset-password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
                </div>
                <div className="field form-span-2">
                  <label htmlFor="reset-confirmation">{translate(locale, "auth.confirmPassword")}</label>
                  <input id="reset-confirmation" name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
                </div>
              </div>
              <div className="modal-footer">
                <button className="button button-secondary" type="button" onClick={() => setResetting(null)} disabled={pending}>{translate(locale, "common.cancel")}</button>
                <button className="button button-primary" type="submit" disabled={pending}>{translate(locale, "admin.resetPassword")}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
