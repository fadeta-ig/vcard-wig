"use client";

import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  EyeOff,
  ExternalLink,
  ImagePlus,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  QrCode,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { SiWhatsapp } from "react-icons/si";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { ProfileStatusBadge } from "@/components/ui/profile-status-badge";
import { SocialPlatformIcon } from "@/components/ui/social-platform-icon";
import type { Locale } from "@/i18n/messages";
import { profileMessages } from "@/i18n/profile-messages";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import {
  DEFAULT_PROFILE_SECTION_ORDER,
  SOCIAL_PLATFORMS,
  slugifyProfile,
  type ProfileSection,
  type ProfileStatusValue,
  type SocialPlatform,
} from "@/lib/profile-options";
import type { CompanyProfileContext, ProfileView } from "@/lib/profile-types";

type SocialDraft = {
  clientId: string;
  platform: SocialPlatform;
  label: string;
  username: string;
  url: string;
  isActive: boolean;
};

type ProfileDraft = {
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  honorificPrefix: string;
  honorificSuffix: string;
  jobTitle: string;
  department: string;
  companyName: string;
  email: string;
  workPhone: string;
  mobilePhone: string;
  whatsappNumber: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  shortBio: string;
  showPhoto: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showSocialLinks: boolean;
  sectionOrder: ProfileSection[];
  socialLinks: SocialDraft[];
};

type TextFieldProps = {
  id: string;
  name: keyof ProfileDraft;
  label: string;
  value: string;
  onChange: (name: keyof ProfileDraft, value: string) => void;
  required?: boolean;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  span?: boolean;
  textarea?: boolean;
};

function TextField({
  id,
  name,
  label,
  value,
  onChange,
  required,
  type = "text",
  maxLength,
  placeholder,
  hint,
  span,
  textarea,
}: TextFieldProps) {
  const common = {
    id,
    name: String(name),
    value,
    required,
    maxLength,
    placeholder,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(name, event.target.value),
  };
  return (
    <div className={`field${span ? " form-span-2" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {textarea ? <textarea {...common} /> : <input {...common} type={type} />}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

function initialDraft(profile: ProfileView | null, company: CompanyProfileContext): ProfileDraft {
  return {
    slug: profile?.slug ?? "",
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    displayName: profile?.displayName ?? "",
    honorificPrefix: profile?.honorificPrefix ?? "",
    honorificSuffix: profile?.honorificSuffix ?? "",
    jobTitle: profile?.jobTitle ?? "",
    department: profile?.department ?? "",
    companyName: profile?.companyName ?? company.name,
    email: profile?.email ?? "",
    workPhone: profile?.workPhone ?? "",
    mobilePhone: profile?.mobilePhone ?? "",
    whatsappNumber: profile?.whatsappNumber ?? "",
    website: profile?.website ?? "",
    addressLine1: profile?.addressLine1 ?? "",
    addressLine2: profile?.addressLine2 ?? "",
    city: profile?.city ?? "",
    province: profile?.province ?? "",
    postalCode: profile?.postalCode ?? "",
    country: profile?.country ?? "Indonesia",
    shortBio: profile?.shortBio ?? "",
    showPhoto: profile?.showPhoto ?? true,
    showEmail: profile?.showEmail ?? true,
    showPhone: profile?.showPhone ?? true,
    showAddress: profile?.showAddress ?? true,
    showSocialLinks: profile?.showSocialLinks ?? true,
    sectionOrder: profile?.sectionOrder ?? [...DEFAULT_PROFILE_SECTION_ORDER],
    socialLinks:
      profile?.socialLinks.map((link) => ({
        clientId: link.id,
        platform: link.platform,
        label: link.label ?? "",
        username: link.username ?? "",
        url: link.url,
        isActive: link.isActive,
      })) ?? [],
  };
}

function statusLabel(status: ProfileStatusValue, copy: ReturnType<typeof profileMessages>) {
  return { DRAFT: copy.draft, ACTIVE: copy.active, INACTIVE: copy.inactive, ARCHIVED: copy.archived }[status];
}

function platformLabel(platform: SocialPlatform): string {
  return platform === "X" ? "X" : platform === "CUSTOM" ? "Custom link" : platform.charAt(0) + platform.slice(1).toLowerCase();
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiClientError)) return fallback;
  const firstFieldError = error.fields
    ? Object.values(error.fields).flat().find(Boolean)
    : undefined;
  return firstFieldError ?? error.message;
}

export function ProfileEditor({
  locale,
  company,
  initialProfile,
  initialNotice,
}: {
  locale: Locale;
  company: CompanyProfileContext;
  initialProfile: ProfileView | null;
  initialNotice?: "created" | "saved" | "photo-error";
}) {
  const copy = profileMessages(locale);
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft(initialProfile, company));
  const [status, setStatus] = useState<ProfileStatusValue>(initialProfile?.status ?? "DRAFT");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialProfile));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPath, setPhotoPath] = useState(initialProfile?.profilePhoto ?? null);
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialNotice === "created" ? copy.created : initialNotice === "saved" ? copy.saved : null,
  );
  const [error, setError] = useState<string | null>(
    initialNotice === "photo-error" ? copy.photoUploadFailed : null,
  );

  useEffect(() => {
    return () => {
      if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    };
  }, [photoObjectUrl]);

  const photoPreview = photoObjectUrl ?? photoPath;

  function setField(name: keyof ProfileDraft, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function setNameField(name: "firstName" | "lastName", value: string) {
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (!slugTouched) {
        const automatic = slugifyProfile([next.firstName, next.lastName].filter(Boolean).join(" "));
        next.slug = automatic.length >= 2 ? automatic : "contact";
      }
      return next;
    });
  }

  function toggleField(name: "showPhoto" | "showEmail" | "showPhone" | "showAddress" | "showSocialLinks") {
    setDraft((current) => ({ ...current, [name]: !current[name] }));
  }

  function addSocialLink() {
    setDraft((current) => {
      if (current.socialLinks.length >= 20) return current;
      return {
        ...current,
        socialLinks: [
          ...current.socialLinks,
          {
            clientId: crypto.randomUUID(),
            platform: "LINKEDIN",
            label: "",
            username: "",
            url: "",
            isActive: true,
          },
        ],
      };
    });
  }

  function updateSocialLink(index: number, patch: Partial<SocialDraft>) {
    setDraft((current) => ({
      ...current,
      socialLinks: current.socialLinks.map((link, position) =>
        position === index ? { ...link, ...patch } : link,
      ),
    }));
  }

  function moveSocialLink(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.socialLinks.length) return current;
      const socialLinks = [...current.socialLinks];
      [socialLinks[index], socialLinks[target]] = [socialLinks[target], socialLinks[index]];
      return { ...current, socialLinks };
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.sectionOrder.length) return current;
      const sectionOrder = [...current.sectionOrder];
      [sectionOrder[index], sectionOrder[target]] = [sectionOrder[target], sectionOrder[index]];
      return { ...current, sectionOrder };
    });
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(copy.photoHint);
      event.target.value = "";
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoObjectUrl(URL.createObjectURL(file));
  }

  async function removePhoto() {
    if (!initialProfile || !photoPath) {
      setPhotoFile(null);
      setPhotoObjectUrl(null);
      setPhotoPath(null);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/profiles/${initialProfile.id}/photo`, { method: "DELETE" });
      setPhotoFile(null);
      setPhotoObjectUrl(null);
      setPhotoPath(null);
      setMessage(copy.saved);
    } catch (caught) {
      setError(errorMessage(caught, copy.photoUploadFailed));
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const payload = {
      ...draft,
      socialLinks: draft.socialLinks.map(({ clientId, ...link }) => {
        void clientId;
        return link;
      }),
    };

    try {
      const saved = await apiRequest<ProfileView>(
        initialProfile ? `/api/admin/profiles/${initialProfile.id}` : "/api/admin/profiles",
        { method: initialProfile ? "PATCH" : "POST", body: payload },
      );
      let uploadedPhoto = saved.profilePhoto;
      if (photoFile) {
        const body = new FormData();
        body.set("file", photoFile);
        try {
          const uploaded = await apiRequest<{ profilePhoto: string; profileThumbnail: string }>(
            `/api/admin/profiles/${saved.id}/photo`,
            { method: "POST", body },
          );
          uploadedPhoto = uploaded.profilePhoto;
          setPhotoFile(null);
          setPhotoObjectUrl(null);
          setPhotoPath(uploaded.profilePhoto);
        } catch (caught) {
          if (!initialProfile) {
            router.push(`/admin/profiles/${saved.id}/edit?notice=photo-error` as Route);
            return;
          }
          throw caught;
        }
      }
      setPhotoPath(uploadedPhoto);
      if (!initialProfile) {
        router.push(`/admin/profiles/${saved.id}/edit?notice=created` as Route);
      } else {
        setMessage(copy.saved);
        router.refresh();
      }
    } catch (caught) {
      setError(errorMessage(caught, copy.photoUploadFailed));
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(nextStatus: ProfileStatusValue) {
    if (!initialProfile) return;
    if (nextStatus === "ARCHIVED" && !window.confirm(copy.archiveConfirm)) return;
    setPending(true);
    setError(null);
    try {
      const updated = await apiRequest<ProfileView>(`/api/admin/profiles/${initialProfile.id}/status`, {
        method: "POST",
        body: { status: nextStatus },
      });
      setStatus(updated.status);
      setMessage(copy.statusChanged);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, copy.photoUploadFailed));
    } finally {
      setPending(false);
    }
  }

  const fullName = draft.displayName || [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "Nama Karyawan";
  const fullAddress = [draft.addressLine1, draft.addressLine2, draft.city, draft.province, draft.postalCode, draft.country].filter(Boolean).join(", ");
  const activeSocialLinks = draft.socialLinks.filter((link) => link.isActive && link.url);
  const sectionLabels: Record<ProfileSection, string> = {
    CONTACT: copy.contactSection,
    SOCIAL: copy.socialSection,
    ADDRESS: copy.addressSection,
    BIO: copy.bioSection,
  };

  function renderPreviewSection(section: ProfileSection): ReactNode {
    if (section === "CONTACT") {
      const hasContact = (draft.showEmail && draft.email) || (draft.showPhone && (draft.workPhone || draft.mobilePhone || draft.whatsappNumber)) || draft.website;
      if (!hasContact) return null;
      return (
        <section className="contact-preview-section" key={section}>
          <h4>{sectionLabels[section]}</h4>
          {draft.showEmail && draft.email ? <p><Mail size={15} />{draft.email}</p> : null}
          {draft.showPhone && draft.mobilePhone ? <p><Phone size={15} />{draft.mobilePhone}</p> : null}
          {draft.showPhone && draft.workPhone ? <p><Phone size={15} />{draft.workPhone}</p> : null}
          {draft.showPhone && draft.whatsappNumber ? <p><SiWhatsapp className="contact-preview-whatsapp-icon" size={15} aria-hidden="true" />{draft.whatsappNumber}</p> : null}
          {draft.website ? <p><Link2 size={15} />{draft.website}</p> : null}
        </section>
      );
    }
    if (section === "SOCIAL") {
      if (!draft.showSocialLinks || activeSocialLinks.length === 0) return null;
      return <section className="contact-preview-section" key={section}><h4>{sectionLabels[section]}</h4><div className="contact-preview-socials">{activeSocialLinks.map((link) => <SocialPlatformIcon key={link.clientId} platform={link.platform} label={link.label || platformLabel(link.platform)} size={20} className="social-preview-icon" />)}</div></section>;
    }
    if (section === "ADDRESS") {
      if (!draft.showAddress || !fullAddress) return null;
      return <section className="contact-preview-section" key={section}><h4>{sectionLabels[section]}</h4><p><MapPin size={15} />{fullAddress}</p></section>;
    }
    if (!draft.shortBio) return null;
    return <section className="contact-preview-section" key={section}><h4>{sectionLabels[section]}</h4><p className="preview-bio">{draft.shortBio}</p></section>;
  }

  const style = { "--preview-brand": company.primaryColor } as CSSProperties;
  return (
    <>
      <div className="page-header profile-editor-header">
        <div>
          <Link className="back-link" href="/admin/profiles"><ArrowLeft size={15} />{copy.back}</Link>
          <div className="profile-title-line">
            <h1>{initialProfile ? copy.edit : copy.add}</h1>
            {initialProfile ? <ProfileStatusBadge status={status} label={statusLabel(status, copy)} /> : null}
          </div>
          <p>{initialProfile ? copy.editSubtitle : copy.createSubtitle}</p>
        </div>
        {initialProfile ? (
          <div className="profile-status-actions">
            {status !== "ARCHIVED" ? <Link className="button button-secondary" href={`/admin/profiles/${initialProfile.id}/qr` as Route}><QrCode size={16} />{copy.qrVcard}</Link> : null}
            {status === "ACTIVE" || status === "INACTIVE" ? <Link className="button button-secondary" href={`/c/${initialProfile.slug}` as Route} target="_blank" rel="noreferrer"><ExternalLink size={16} />{copy.viewPublic}</Link> : null}
            {status === "DRAFT" || status === "INACTIVE" ? <button className="button button-primary" type="button" disabled={pending} onClick={() => changeStatus("ACTIVE")}><Send size={16} />{copy.publish}</button> : null}
            {status === "ACTIVE" ? <button className="button button-secondary" type="button" disabled={pending} onClick={() => changeStatus("INACTIVE")}><EyeOff size={16} />{copy.deactivate}</button> : null}
            {status === "ARCHIVED" ? <button className="button button-secondary" type="button" disabled={pending} onClick={() => changeStatus("DRAFT")}><RotateCcw size={16} />{copy.restore}</button> : <button className="button button-danger" type="button" disabled={pending} onClick={() => changeStatus("ARCHIVED")}><Archive size={16} />{copy.archive}</button>}
          </div>
        ) : null}
      </div>

      {message ? <div className="alert alert-success profile-alert" role="status">{message}</div> : null}
      {error ? <div className="alert alert-error profile-alert" role="alert">{error}</div> : null}

      <div className="profile-editor-layout">
        <form className="profile-form" onSubmit={submit}>
          <section className="profile-form-section">
            <div className="profile-form-heading"><h2>{copy.basic}</h2><p>{company.name}</p></div>
            <div className="form-grid">
              <TextField id="profile-prefix" name="honorificPrefix" label={copy.prefix} value={draft.honorificPrefix} onChange={setField} maxLength={30} />
              <TextField id="profile-suffix" name="honorificSuffix" label={copy.suffix} value={draft.honorificSuffix} onChange={setField} maxLength={30} />
              <TextField id="profile-first-name" name="firstName" label={copy.firstName} value={draft.firstName} onChange={(name, value) => setNameField(name as "firstName", value)} maxLength={100} required />
              <TextField id="profile-last-name" name="lastName" label={copy.lastName} value={draft.lastName} onChange={(name, value) => setNameField(name as "lastName", value)} maxLength={100} />
              <TextField id="profile-display-name" name="displayName" label={copy.displayName} value={draft.displayName} onChange={setField} maxLength={120} placeholder={fullName} />
              <div className="field"><label htmlFor="profile-slug">{copy.slug}</label><input id="profile-slug" value={draft.slug} required minLength={2} maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" disabled={Boolean(initialProfile?.publishedAt)} onChange={(event) => { setSlugTouched(true); setField("slug", event.target.value.toLowerCase()); }} /><p className="field-hint">{initialProfile?.publishedAt ? (locale === "id" ? "Slug dikunci setelah profil dipublikasikan agar QR lama tetap berlaku." : "The slug is locked after publishing so existing QR codes remain valid.") : copy.autoSlug}</p></div>
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading"><h2>{copy.work}</h2></div>
            <div className="form-grid">
              <TextField id="profile-job-title" name="jobTitle" label={copy.jobTitle} value={draft.jobTitle} onChange={setField} maxLength={120} required />
              <TextField id="profile-department" name="department" label={copy.department} value={draft.department} onChange={setField} maxLength={120} />
              <TextField id="profile-company-name" name="companyName" label={copy.companyName} value={draft.companyName} onChange={setField} maxLength={160} required span />
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading"><h2>{copy.contact}</h2><p>{copy.internationalPhone}</p></div>
            <div className="form-grid">
              <TextField id="profile-email" name="email" label={copy.email} value={draft.email} onChange={setField} type="email" maxLength={191} required span />
              <TextField id="profile-work-phone" name="workPhone" label={copy.workPhone} value={draft.workPhone} onChange={setField} type="tel" maxLength={32} placeholder="+62311234567" />
              <TextField id="profile-mobile-phone" name="mobilePhone" label={copy.mobilePhone} value={draft.mobilePhone} onChange={setField} type="tel" maxLength={32} placeholder="+628123456789" />
              <TextField id="profile-whatsapp" name="whatsappNumber" label={copy.whatsapp} value={draft.whatsappNumber} onChange={setField} type="tel" maxLength={32} placeholder="+628123456789" />
              <TextField id="profile-website" name="website" label={copy.website} value={draft.website} onChange={setField} type="url" maxLength={500} placeholder="https://" />
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading"><h2>{copy.address}</h2></div>
            <div className="form-grid">
              <TextField id="profile-address-1" name="addressLine1" label={copy.address1} value={draft.addressLine1} onChange={setField} maxLength={255} span />
              <TextField id="profile-address-2" name="addressLine2" label={copy.address2} value={draft.addressLine2} onChange={setField} maxLength={255} span />
              <TextField id="profile-city" name="city" label={copy.city} value={draft.city} onChange={setField} maxLength={100} />
              <TextField id="profile-province" name="province" label={copy.province} value={draft.province} onChange={setField} maxLength={100} />
              <TextField id="profile-postal-code" name="postalCode" label={copy.postalCode} value={draft.postalCode} onChange={setField} maxLength={20} />
              <TextField id="profile-country" name="country" label={copy.country} value={draft.country} onChange={setField} maxLength={100} />
              <TextField id="profile-bio" name="shortBio" label={copy.bio} value={draft.shortBio} onChange={setField} maxLength={2000} textarea span />
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading profile-heading-actions"><div><h2>{copy.social}</h2><p>{copy.noSocial}</p></div><button className="button button-secondary button-sm" type="button" onClick={addSocialLink} disabled={draft.socialLinks.length >= 20}><Plus size={15} />{copy.addSocial}</button></div>
            <div className="social-editor-list">
              {draft.socialLinks.map((link, index) => (
                <div className="social-editor-row" key={link.clientId}>
                  <div className="social-row-order"><SocialPlatformIcon platform={link.platform} label={link.label || platformLabel(link.platform)} size={18} className="social-editor-brand" /><div className="social-order-buttons"><button className="icon-button" type="button" aria-label={copy.moveUp} disabled={index === 0} onClick={() => moveSocialLink(index, -1)}><ArrowUp size={15} /></button><button className="icon-button" type="button" aria-label={copy.moveDown} disabled={index === draft.socialLinks.length - 1} onClick={() => moveSocialLink(index, 1)}><ArrowDown size={15} /></button></div></div>
                  <div className="field"><label htmlFor={`social-platform-${link.clientId}`}>{copy.platform}</label><select id={`social-platform-${link.clientId}`} value={link.platform} onChange={(event) => updateSocialLink(index, { platform: event.target.value as SocialPlatform })}>{SOCIAL_PLATFORMS.map((platform) => <option value={platform} key={platform}>{platformLabel(platform)}</option>)}</select></div>
                  <div className="field"><label htmlFor={`social-label-${link.clientId}`}>{copy.label}</label><input id={`social-label-${link.clientId}`} value={link.label} required={link.platform === "CUSTOM"} maxLength={80} onChange={(event) => updateSocialLink(index, { label: event.target.value })} /></div>
                  <div className="field"><label htmlFor={`social-username-${link.clientId}`}>{copy.username}</label><input id={`social-username-${link.clientId}`} value={link.username} maxLength={100} onChange={(event) => updateSocialLink(index, { username: event.target.value })} /></div>
                  <div className="field social-url-field"><label htmlFor={`social-url-${link.clientId}`}>{copy.url}</label><input id={`social-url-${link.clientId}`} value={link.url} type="url" required maxLength={500} placeholder="https://" onChange={(event) => updateSocialLink(index, { url: event.target.value })} /></div>
                  <label className="checkbox-field social-active"><input type="checkbox" checked={link.isActive} onChange={() => updateSocialLink(index, { isActive: !link.isActive })} /><span>{copy.visible}</span></label>
                  <button className="icon-button danger-icon" type="button" aria-label={copy.remove} onClick={() => setDraft((current) => ({ ...current, socialLinks: current.socialLinks.filter((_, position) => position !== index) }))}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading"><h2>{copy.appearance}</h2></div>
            <div className="photo-editor-row">
              <div className="photo-editor-preview">{photoPreview ? <Image src={photoPreview} alt="" width={112} height={112} unoptimized /> : <ImagePlus size={28} />}</div>
              <div><p className="field-label">{copy.photo}</p><p className="field-hint">{copy.photoHint}</p><div className="asset-actions"><label className="button button-secondary button-sm"><ImagePlus size={15} />{copy.upload}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={pending} /></label>{photoPreview ? <button className="button button-danger button-sm" type="button" onClick={removePhoto} disabled={pending}><Trash2 size={15} />{copy.removePhoto}</button> : null}</div></div>
            </div>
            <div className="visibility-grid">
              {(["showPhoto", "showEmail", "showPhone", "showAddress", "showSocialLinks"] as const).map((field) => <label className="checkbox-field" key={field}><input type="checkbox" checked={draft[field]} onChange={() => toggleField(field)} /><span>{{ showPhoto: copy.showPhoto, showEmail: copy.showEmail, showPhone: copy.showPhone, showAddress: copy.showAddress, showSocialLinks: copy.showSocial }[field]}</span></label>)}
            </div>
            <div className="section-order-editor"><p className="field-label">{copy.sectionOrder}</p>{draft.sectionOrder.map((section, index) => <div key={section}><span>{index + 1}. {sectionLabels[section]}</span><span><button className="icon-button" type="button" aria-label={copy.moveUp} disabled={index === 0} onClick={() => moveSection(index, -1)}><ArrowUp size={15} /></button><button className="icon-button" type="button" aria-label={copy.moveDown} disabled={index === draft.sectionOrder.length - 1} onClick={() => moveSection(index, 1)}><ArrowDown size={15} /></button></span></div>)}</div>
          </section>

          <div className="profile-form-footer"><Link className="button button-secondary" href="/admin/profiles">{copy.cancel}</Link><button className="button button-primary" type="submit" disabled={pending}>{pending ? copy.saving : initialProfile ? copy.saveChanges : copy.saveDraft}</button></div>
        </form>

        <aside className="profile-preview-panel" style={style}>
          <div className="profile-preview-header"><div><h2>{copy.preview}</h2><p>{copy.previewHint}</p></div><div className="preview-mode-switcher" role="group" aria-label={copy.preview}>{(["mobile", "tablet", "desktop"] as const).map((mode) => <button key={mode} className={previewMode === mode ? "is-active" : undefined} type="button" onClick={() => setPreviewMode(mode)}>{copy[mode]}</button>)}</div></div>
          <div className={`preview-stage preview-${previewMode}`}>
            <article className="contact-preview-card">
              <div className="contact-preview-brand">{company.companyLogo ? <Image src={company.companyLogo} alt={company.name} width={112} height={40} unoptimized /> : <strong>{company.name}</strong>}</div>
              {draft.showPhoto ? (photoPreview ? <Image className="contact-preview-photo" src={photoPreview} alt="" width={112} height={112} unoptimized /> : <div className="contact-preview-photo contact-preview-placeholder">{fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>) : null}
              <h3>{draft.honorificPrefix ? `${draft.honorificPrefix} ` : ""}{fullName}{draft.honorificSuffix ? `, ${draft.honorificSuffix}` : ""}</h3>
              <p className="contact-preview-title">{draft.jobTitle || copy.jobTitle}</p>
              {draft.department ? <p className="contact-preview-department">{draft.department}</p> : null}
              <p className="contact-preview-company">{draft.companyName || company.name}</p>
              <div className="contact-preview-divider" />
              {draft.sectionOrder.map(renderPreviewSection)}
              {!draft.sectionOrder.some((section) => Boolean(renderPreviewSection(section))) ? <p className="contact-preview-empty">{copy.noVisibleDetails}</p> : null}
            </article>
          </div>
        </aside>
      </div>
    </>
  );
}
