"use client";

import { ArrowLeft, Download, ExternalLink, FileUser, QrCode } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/messages";
import { qrMessages } from "@/i18n/qr-messages";
import type { ProfileStatusValue } from "@/lib/profile-options";

type QrProfile = {
  id: string;
  slug: string;
  displayName: string;
  status: ProfileStatusValue;
  company: {
    name: string;
    companyLogo: string | null;
    qrLogoEnabled: boolean;
    defaultQrForeground: string;
    defaultQrBackground: string;
  };
  publicUrl: string;
};

export function QrManager({ locale, profile }: { locale: Locale; profile: QrProfile }) {
  const copy = qrMessages(locale);
  const [type, setType] = useState<"dynamic" | "vcard">("dynamic");
  const [format, setFormat] = useState<"png" | "svg">("png");
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(4);
  const [errorCorrection, setErrorCorrection] = useState<"L" | "M" | "Q" | "H">("M");
  const [foreground, setForeground] = useState(profile.company.defaultQrForeground);
  const [background, setBackground] = useState(profile.company.defaultQrBackground);
  const [logo, setLogo] = useState(profile.company.qrLogoEnabled && Boolean(profile.company.companyLogo));
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const effectiveCorrection = logo ? "H" : errorCorrection;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      type,
      format,
      size: String(size),
      margin: String(margin),
      errorCorrection: effectiveCorrection,
      foreground,
      background,
      logo: String(logo),
    });
    return params.toString();
  }, [background, effectiveCorrection, foreground, format, logo, margin, size, type]);
  const previewUrl = `/api/admin/profiles/${profile.id}/qr?${query}`;
  const downloadUrl = `${previewUrl}&download=true`;

  const previewFailed = failedPreviewUrl === previewUrl;

  const warning = profile.status === "DRAFT"
    ? copy.draftWarning
    : profile.status === "INACTIVE"
      ? copy.inactiveWarning
      : profile.status === "ARCHIVED"
        ? copy.archivedWarning
        : null;

  return (
    <>
      <div className="page-header qr-page-header">
        <div>
          <Link className="back-link" href={`/admin/profiles/${profile.id}/edit` as Route}><ArrowLeft size={15} />{copy.back}</Link>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        {profile.status === "ACTIVE" || profile.status === "INACTIVE" ? <Link className="button button-secondary" href={`/c/${profile.slug}` as Route} target="_blank" rel="noreferrer"><ExternalLink size={16} />{copy.openPublic}</Link> : null}
      </div>

      {warning ? <div className="alert alert-warning qr-status-warning" role="status">{warning}</div> : null}

      <div className="qr-manager-layout">
        <section className="qr-preview-panel" aria-labelledby="qr-preview-title">
          <div className="qr-section-heading"><h2 id="qr-preview-title">{copy.preview}</h2><p>{profile.displayName}</p></div>
          <div className="qr-preview-frame">
            {previewFailed ? <div className="qr-preview-error" role="alert"><QrCode size={40} aria-hidden="true" /><p>{copy.previewError}</p></div> : <Image src={previewUrl} alt={`${copy.preview} ${profile.displayName}`} width={320} height={320} unoptimized onError={() => setFailedPreviewUrl(previewUrl)} />}
          </div>
          <div className="qr-download-actions">
            <a className="button button-primary" href={downloadUrl} download><Download size={16} />{copy.downloadQr} {format.toUpperCase()}</a>
            <a className="button button-secondary" href={`/api/admin/profiles/${profile.id}/vcard`} download><FileUser size={16} />{copy.downloadVcard}</a>
          </div>
          <div className="qr-source-summary">
            <strong>{type === "dynamic" ? copy.source : copy.direct}</strong>
            <code>{type === "dynamic" ? profile.publicUrl : copy.visiblePolicy}</code>
          </div>
        </section>

        <section className="qr-settings-panel" aria-labelledby="qr-settings-title">
          <div className="qr-section-heading"><h2 id="qr-settings-title">{copy.settings}</h2><p>{profile.company.name}</p></div>

          <fieldset className="qr-option-group">
            <legend>{copy.qrType}</legend>
            <div className="qr-segmented-control">
              <button className={type === "dynamic" ? "is-active" : undefined} type="button" onClick={() => setType("dynamic")}>{copy.dynamic}</button>
              <button className={type === "vcard" ? "is-active" : undefined} type="button" onClick={() => setType("vcard")}>{copy.direct}</button>
            </div>
            <p className="field-hint">{type === "dynamic" ? copy.dynamicHint : copy.directHint}</p>
          </fieldset>

          <div className="qr-settings-grid">
            <div className="field"><label htmlFor="qr-format">{copy.format}</label><select id="qr-format" value={format} onChange={(event) => setFormat(event.target.value as "png" | "svg")}><option value="png">PNG</option><option value="svg">SVG</option></select></div>
            <div className="field"><label htmlFor="qr-size">{copy.size}</label><select id="qr-size" value={size} onChange={(event) => setSize(Number(event.target.value))}>{[256, 512, 1024, 2048].map((value) => <option value={value} key={value}>{value} × {value} px</option>)}</select></div>
            <div className="field"><label htmlFor="qr-margin">{copy.margin}</label><input id="qr-margin" type="number" min={4} max={16} value={margin} onChange={(event) => setMargin(Math.min(16, Math.max(4, Number(event.target.value) || 4)))} /></div>
            <div className="field"><label htmlFor="qr-correction">{copy.correction}</label><select id="qr-correction" value={effectiveCorrection} disabled={logo} onChange={(event) => setErrorCorrection(event.target.value as "L" | "M" | "Q" | "H")}><option value="L">L — 7%</option><option value="M">M — 15%</option><option value="Q">Q — 25%</option><option value="H">H — 30%</option></select></div>
            <label className="qr-color-field" htmlFor="qr-foreground"><span>{copy.foreground}</span><span><input id="qr-foreground" type="color" value={foreground} onChange={(event) => setForeground(event.target.value.toUpperCase())} /><code>{foreground}</code></span></label>
            <label className="qr-color-field" htmlFor="qr-background"><span>{copy.background}</span><span><input id="qr-background" type="color" value={background} onChange={(event) => setBackground(event.target.value.toUpperCase())} /><code>{background}</code></span></label>
          </div>

          <label className="checkbox-field qr-logo-option">
            <input type="checkbox" checked={logo} disabled={!profile.company.companyLogo} onChange={() => setLogo((current) => !current)} />
            <span>{copy.logo}</span>
          </label>
          <p className="field-hint">{profile.company.companyLogo ? copy.logoCorrection : copy.logoUnavailable}</p>
          <p className="qr-visibility-note">{copy.visiblePolicy}</p>
        </section>
      </div>
    </>
  );
}
