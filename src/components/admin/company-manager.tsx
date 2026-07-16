"use client";

import { Building2, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { translate } from "@/i18n/messages";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export type CompanyView = {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  companyLogo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  qrLogoEnabled: boolean;
  defaultQrForeground: string;
  defaultQrBackground: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { profiles: number; memberships: number };
};

type AssetResponse = { assetType: "logo" | "favicon"; path: string };

function sortedCompanies(companies: CompanyView[]): CompanyView[] {
  return [...companies].sort(
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

export function CompanyManager({ initialCompanies, locale }: { initialCompanies: CompanyView[]; locale: Locale }) {
  const [companies, setCompanies] = useState(() => sortedCompanies(initialCompanies));
  const [editing, setEditing] = useState<CompanyView | "new" | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const company = editing === "new" ? null : editing;
  const title = editing === "new" ? translate(locale, "company.add") : translate(locale, "company.edit");

  const companyMap = useMemo(
    () => new Map(companies.map((item) => [item.id, item])),
    [companies],
  );

  function replaceCompany(next: CompanyView) {
    setCompanies((current) => sortedCompanies([...current.filter((item) => item.id !== next.id), next]));
    setEditing(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const input = {
      name: form.get("name"),
      slug: form.get("slug"),
      legalName: form.get("legalName"),
      website: form.get("website"),
      email: form.get("email"),
      phone: form.get("phone"),
      address: form.get("address"),
      primaryColor: form.get("primaryColor"),
      secondaryColor: form.get("secondaryColor"),
      defaultQrForeground: form.get("defaultQrForeground"),
      defaultQrBackground: form.get("defaultQrBackground"),
      qrLogoEnabled: form.has("qrLogoEnabled"),
      isActive: form.has("isActive"),
    };

    try {
      const result = await apiRequest<CompanyView>(
        company ? `/api/admin/companies/${company.id}` : "/api/admin/companies",
        { method: company ? "PATCH" : "POST", body: input },
      );
      setCompanies((current) =>
        sortedCompanies([...current.filter((item) => item.id !== result.id), result]),
      );
      setEditing(null);
      setMessage(
        translate(locale, company ? "company.updated" : "company.created"),
      );
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : translate(locale, "common.error"));
    } finally {
      setPending(false);
    }
  }

  async function uploadAsset(assetType: "logo" | "favicon", file: File | undefined) {
    if (!company || !file) return;
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("assetType", assetType);
    body.set("file", file);
    try {
      const result = await apiRequest<AssetResponse>(`/api/admin/companies/${company.id}/assets`, {
        method: "POST",
        body,
      });
      const next = {
        ...(companyMap.get(company.id) ?? company),
        [assetType === "logo" ? "companyLogo" : "favicon"]: result.path,
      } as CompanyView;
      replaceCompany(next);
      setMessage(translate(locale, "company.assetUpdated"));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : translate(locale, "common.error"));
    } finally {
      setPending(false);
    }
  }

  async function removeAsset(assetType: "logo" | "favicon") {
    if (!company) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/companies/${company.id}/assets`, {
        method: "DELETE",
        body: { assetType },
      });
      const next = {
        ...(companyMap.get(company.id) ?? company),
        [assetType === "logo" ? "companyLogo" : "favicon"]: null,
      } as CompanyView;
      replaceCompany(next);
      setMessage(translate(locale, "company.assetUpdated"));
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
          <h1>{translate(locale, "company.title")}</h1>
          <p>{translate(locale, "company.subtitle")}</p>
        </div>
        <button className="button button-primary" type="button" onClick={() => setEditing("new")}>
          <Plus size={17} aria-hidden="true" />
          {translate(locale, "company.add")}
        </button>
      </div>

      {message ? (
        <div className="alert alert-success" role="status" style={{ marginBottom: 18 }}>
          {message}
        </div>
      ) : null}
      {error && !editing ? (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 18 }}>
          {error}
        </div>
      ) : null}

      {companies.length === 0 ? (
        <EmptyState title={translate(locale, "company.empty")}>
          <button className="button button-secondary" type="button" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden="true" />
            {translate(locale, "company.add")}
          </button>
        </EmptyState>
      ) : (
        <section className="content-panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translate(locale, "company.name")}</th>
                  <th>{translate(locale, "company.status")}</th>
                  <th>{translate(locale, "admin.companies")}</th>
                  <th>{translate(locale, "nav.profiles")}</th>
                  <th><span className="sr-only">{translate(locale, "common.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="entity-cell">
                        <span className="entity-logo">
                          {item.companyLogo ? (
                            <Image src={item.companyLogo} alt="" width={38} height={38} unoptimized />
                          ) : (
                            initials(item.name)
                          )}
                        </span>
                        <span>
                          <span className="entity-name">{item.name}</span>
                          <span className="entity-meta">/{item.slug}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        active={item.isActive}
                        activeLabel={translate(locale, "common.active")}
                        inactiveLabel={translate(locale, "common.inactive")}
                      />
                    </td>
                    <td>{item._count.memberships}</td>
                    <td>{item._count.profiles}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="button button-secondary button-sm"
                          type="button"
                          onClick={() => setEditing(item)}
                        >
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
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="company-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="company-modal-title">{title}</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {company?.name ?? translate(locale, "company.subtitle")}
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label={translate(locale, "common.close")}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body form-grid">
                {error ? <div className="alert alert-error form-span-2" role="alert">{error}</div> : null}
                <div className="form-section form-span-2">
                  <p className="form-section-title">{locale === "id" ? "Identitas" : "Identity"}</p>
                </div>
                <div className="field">
                  <label htmlFor="company-name">{translate(locale, "company.name")}</label>
                  <input id="company-name" name="name" defaultValue={company?.name ?? ""} minLength={2} maxLength={120} required />
                </div>
                <div className="field">
                  <label htmlFor="company-slug">{translate(locale, "company.slug")}</label>
                  <input id="company-slug" name="slug" defaultValue={company?.slug ?? ""} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} required />
                </div>
                <div className="field form-span-2">
                  <label htmlFor="company-legal">{translate(locale, "company.legalName")}</label>
                  <input id="company-legal" name="legalName" defaultValue={company?.legalName ?? ""} maxLength={160} />
                </div>
                <div className="field">
                  <label htmlFor="company-email">{translate(locale, "company.email")}</label>
                  <input id="company-email" name="email" type="email" defaultValue={company?.email ?? ""} maxLength={191} />
                </div>
                <div className="field">
                  <label htmlFor="company-phone">{translate(locale, "company.phone")}</label>
                  <input id="company-phone" name="phone" defaultValue={company?.phone ?? ""} maxLength={32} />
                </div>
                <div className="field form-span-2">
                  <label htmlFor="company-website">{translate(locale, "company.website")}</label>
                  <input id="company-website" name="website" type="url" defaultValue={company?.website ?? ""} maxLength={500} placeholder="https://" />
                </div>
                <div className="field form-span-2">
                  <label htmlFor="company-address">{translate(locale, "company.address")}</label>
                  <textarea id="company-address" name="address" defaultValue={company?.address ?? ""} maxLength={2000} />
                </div>
                <div className="form-section form-span-2">
                  <p className="form-section-title">Branding & QR</p>
                </div>
                <div className="field">
                  <label htmlFor="primary-color">{translate(locale, "company.primaryColor")}</label>
                  <input id="primary-color" name="primaryColor" type="color" defaultValue={company?.primaryColor ?? "#1E3A5F"} required />
                </div>
                <div className="field">
                  <label htmlFor="secondary-color">{translate(locale, "company.secondaryColor")}</label>
                  <input id="secondary-color" name="secondaryColor" type="text" defaultValue={company?.secondaryColor ?? ""} pattern="#[0-9A-Fa-f]{6}" placeholder="#RRGGBB" />
                </div>
                <div className="field">
                  <label htmlFor="qr-foreground">{translate(locale, "company.qrForeground")}</label>
                  <input id="qr-foreground" name="defaultQrForeground" type="color" defaultValue={company?.defaultQrForeground ?? "#111827"} required />
                </div>
                <div className="field">
                  <label htmlFor="qr-background">{translate(locale, "company.qrBackground")}</label>
                  <input id="qr-background" name="defaultQrBackground" type="color" defaultValue={company?.defaultQrBackground ?? "#FFFFFF"} required />
                </div>
                <label className="checkbox-field form-span-2">
                  <input name="qrLogoEnabled" type="checkbox" defaultChecked={company?.qrLogoEnabled ?? false} />
                  <span>{translate(locale, "company.qrLogo")}</span>
                </label>
                <label className="checkbox-field form-span-2">
                  <input name="isActive" type="checkbox" defaultChecked={company?.isActive ?? true} />
                  <span>{translate(locale, "common.active")}</span>
                </label>

                {company ? (
                  <>
                    <div className="form-section form-span-2">
                      <p className="form-section-title">{locale === "id" ? "Aset" : "Assets"}</p>
                      <p className="field-hint">
                        {locale === "id" ? "JPG, PNG, atau WebP; maksimal 2 MB." : "JPG, PNG, or WebP; maximum 2 MB."}
                      </p>
                    </div>
                    {(["logo", "favicon"] as const).map((assetType) => {
                      const assetPath = assetType === "logo" ? company.companyLogo : company.favicon;
                      return (
                        <div className="asset-row form-span-2" key={assetType}>
                          <div className="asset-preview">
                            {assetPath ? (
                              <Image src={assetPath} alt="" width={88} height={88} unoptimized />
                            ) : assetType === "logo" ? (
                              <Building2 size={25} aria-hidden="true" />
                            ) : (
                              <ImagePlus size={25} aria-hidden="true" />
                            )}
                          </div>
                          <div>
                            <p className="field-label">
                              {translate(locale, assetType === "logo" ? "company.logo" : "company.favicon")}
                            </p>
                            <div className="asset-actions">
                              <label className="button button-secondary button-sm">
                                <ImagePlus size={14} aria-hidden="true" />
                                {translate(locale, "company.upload")}
                                <input
                                  className="sr-only"
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  disabled={pending}
                                  onChange={(event) => uploadAsset(assetType, event.target.files?.[0])}
                                />
                              </label>
                              {assetPath ? (
                                <button className="button button-danger button-sm" type="button" disabled={pending} onClick={() => removeAsset(assetType)}>
                                  <Trash2 size={14} aria-hidden="true" />
                                  {translate(locale, "company.removeAsset")}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </div>
              <div className="modal-footer">
                <button className="button button-secondary" type="button" disabled={pending} onClick={() => setEditing(null)}>
                  {translate(locale, "common.cancel")}
                </button>
                <button className="button button-primary" type="submit" disabled={pending}>
                  {translate(locale, company ? "common.update" : "common.create")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
