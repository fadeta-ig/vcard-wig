import { Building2, ExternalLink, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { resolveSelectedCompany } from "@/services/authorization.service";
import { getSessionFromCookies } from "@/services/auth.service";
import { getCompany } from "@/services/company.service";

export const metadata: Metadata = { title: "Company Settings" };

export default async function CompanySettingsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");
  const [locale, selected] = await Promise.all([getLocale(), resolveSelectedCompany(session)]);

  if (!selected) {
    return (
      <>
        <div className="page-header">
          <div><h1>{translate(locale, "settings.title")}</h1><p>{translate(locale, "settings.subtitle")}</p></div>
        </div>
        <EmptyState title={translate(locale, "company.empty")}>
          <Link className="button button-primary" href="/admin/companies">{translate(locale, "company.add")}</Link>
        </EmptyState>
      </>
    );
  }

  const company = await getCompany(selected.id);
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{translate(locale, "settings.title")}</h1>
          <p>{translate(locale, "settings.subtitle")}</p>
        </div>
        <Link className="button button-primary" href="/admin/companies">
          <Pencil size={16} aria-hidden="true" />
          {translate(locale, "common.edit")}
        </Link>
      </div>
      <section className="content-panel" style={{ padding: 24 }}>
        <div className="entity-cell" style={{ marginBottom: 26 }}>
          <span className="entity-logo" style={{ width: 68, height: 68 }}>
            {company.companyLogo ? <Image src={company.companyLogo} alt="" width={68} height={68} unoptimized /> : <Building2 size={28} />}
          </span>
          <span>
            <span className="entity-name" style={{ fontSize: 19 }}>{company.name}</span>
            <span className="entity-meta">/{company.slug}</span>
            <StatusBadge
              active={company.isActive}
              activeLabel={translate(locale, "common.active")}
              inactiveLabel={translate(locale, "common.inactive")}
            />
          </span>
        </div>
        <div className="form-grid">
          <div><p className="field-label">{translate(locale, "company.legalName")}</p><p>{company.legalName ?? "—"}</p></div>
          <div><p className="field-label">{translate(locale, "company.email")}</p><p>{company.email ?? "—"}</p></div>
          <div><p className="field-label">{translate(locale, "company.phone")}</p><p>{company.phone ?? "—"}</p></div>
          <div>
            <p className="field-label">{translate(locale, "company.website")}</p>
            {company.website ? <a href={company.website} target="_blank" rel="noreferrer">{company.website} <ExternalLink size={12} /></a> : <p>—</p>}
          </div>
          <div className="form-span-2"><p className="field-label">{translate(locale, "company.address")}</p><p>{company.address ?? "—"}</p></div>
          <div><p className="field-label">{translate(locale, "company.primaryColor")}</p><p><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: company.primaryColor, marginRight: 7 }} />{company.primaryColor}</p></div>
          <div><p className="field-label">QR</p><p>{company.defaultQrForeground} / {company.defaultQrBackground}</p></div>
        </div>
      </section>
    </>
  );
}
