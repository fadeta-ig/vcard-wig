"use client";

import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  EyeOff,
  Eye,
  ExternalLink,
  ImagePlus,
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
import {
  useEffect,
  useState,
  useRef,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { PublicProfileCard } from "@/components/public-profile/public-profile-card";
import { presentProfile } from "@/lib/profile-presentation";
import { useUnsavedChanges } from "@/components/admin/unsaved-changes";
import { DeleteProfileDialog } from "@/components/admin/delete-profile-dialog";
import { ModalDialog } from "@/components/ui/modal-dialog";
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
  showWorkPhone: boolean;
  showMobilePhone: boolean;
  showWhatsapp: boolean;
  allowIndexing: boolean;
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
  error?: string;
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
  error,
}: TextFieldProps) {
  const common = {
    id,
    name: String(name),
    value,
    required,
    maxLength,
    placeholder,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(name, event.target.value),
  };
  return (
    <div className={`field${span ? " form-span-2" : ""}`}>
      <label htmlFor={id}>
        {label}
        {required ? (
          <span className="required-mark" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {textarea ? <textarea {...common} /> : <input {...common} type={type} />}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function initialDraft(
  profile: ProfileView | null,
  company: CompanyProfileContext,
): ProfileDraft {
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
    showWorkPhone: profile?.showWorkPhone ?? true,
    showMobilePhone: profile?.showMobilePhone ?? true,
    showWhatsapp: profile?.showWhatsapp ?? true,
    allowIndexing: profile?.allowIndexing ?? false,
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

function platformLabel(platform: SocialPlatform): string {
  return platform === "X"
    ? "X"
    : platform === "CUSTOM"
      ? "Custom link"
      : platform.charAt(0) + platform.slice(1).toLowerCase();
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
  const [draft, setDraft] = useState(() =>
    initialDraft(initialProfile, company),
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(initialDraft(initialProfile, company)),
  );
  const [version, setVersion] = useState(initialProfile?.version ?? 1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [conflict, setConflict] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<ProfileStatusValue>(
    initialProfile?.status ?? "DRAFT",
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(initialProfile));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhotoRequested, setRemovePhotoRequested] = useState(false);
  const [photoPath, setPhotoPath] = useState(
    initialProfile?.profilePhoto ?? null,
  );
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<
    "mobile" | "tablet" | "desktop"
  >("mobile");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialNotice === "created"
      ? copy.created
      : initialNotice === "saved"
        ? copy.saved
        : null,
  );
  const [error, setError] = useState<string | null>(
    initialNotice === "photo-error" ? copy.photoUploadFailed : null,
  );

  useEffect(() => {
    return () => {
      if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    };
  }, [photoObjectUrl]);

  const photoPreview =
    photoObjectUrl ?? (removePhotoRequested ? null : photoPath);
  const dirty =
    JSON.stringify(draft) !== baseline ||
    Boolean(photoFile) ||
    removePhotoRequested;
  useUnsavedChanges(
    dirty,
    locale === "id"
      ? "Ada perubahan yang belum disimpan. Tinggalkan halaman dan abaikan perubahan?"
      : "You have unsaved changes. Leave and discard them?",
  );
  const mutationContext = { companyId: company.id, version };
  function handleError(caught: unknown, fallback: string) {
    setError(errorMessage(caught, fallback));
    if (caught instanceof ApiClientError) {
      setFieldErrors(caught.fields ?? {});
      if (
        ["PROFILE_VERSION_CONFLICT", "COMPANY_CONTEXT_CHANGED"].includes(
          caught.code,
        )
      )
        setConflict(true);
      const first = Object.keys(caught.fields ?? {})[0];
      window.requestAnimationFrame(() => {
        const field = Array.from(formRef.current?.elements ?? []).find(
          (element) => (element as HTMLInputElement).name === first,
        );
        if (field instanceof HTMLElement) field.focus();
      });
    }
  }

  function setField(name: keyof ProfileDraft, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function setNameField(name: "firstName" | "lastName", value: string) {
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (!slugTouched) {
        const automatic = slugifyProfile(
          [next.firstName, next.lastName].filter(Boolean).join(" "),
        );
        next.slug = automatic.length >= 2 ? automatic : "contact";
      }
      return next;
    });
  }

  function toggleField(
    name:
      | "showPhoto"
      | "showEmail"
      | "showPhone"
      | "showWorkPhone"
      | "showMobilePhone"
      | "showWhatsapp"
      | "allowIndexing"
      | "showAddress"
      | "showSocialLinks",
  ) {
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
      [socialLinks[index], socialLinks[target]] = [
        socialLinks[target],
        socialLinks[index],
      ];
      return { ...current, socialLinks };
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.sectionOrder.length) return current;
      const sectionOrder = [...current.sectionOrder];
      [sectionOrder[index], sectionOrder[target]] = [
        sectionOrder[target],
        sectionOrder[index],
      ];
      return { ...current, sectionOrder };
    });
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError(copy.photoHint);
      event.target.value = "";
      return;
    }
    setError(null);
    setRemovePhotoRequested(false);
    setPhotoFile(file);
    setPhotoObjectUrl(URL.createObjectURL(file));
  }

  function removePhoto() {
    if (photoFile) {
      setPhotoFile(null);
      setPhotoObjectUrl(null);
      return;
    }
    setRemovePhotoRequested(true);
  }

  async function submit(
    event?: FormEvent<HTMLFormElement>,
    publishAfter = false,
  ) {
    event?.preventDefault();
    if (conflict || !formRef.current?.reportValidity()) return;
    setFieldErrors({});
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
        initialProfile
          ? `/api/admin/profiles/${initialProfile.id}`
          : "/api/admin/profiles",
        {
          method: initialProfile ? "PATCH" : "POST",
          body: payload,
          profileContext: mutationContext,
        },
      );
      let currentVersion = saved.version;
      setVersion(currentVersion);
      let uploadedPhoto = saved.profilePhoto;
      if (removePhotoRequested) {
        const removed = await apiRequest<{ version: number }>(
          `/api/admin/profiles/${saved.id}/photo`,
          {
            method: "DELETE",
            profileContext: { companyId: company.id, version: currentVersion },
          },
        );
        currentVersion = removed.version;
        setVersion(currentVersion);
        uploadedPhoto = null;
        setRemovePhotoRequested(false);
      }
      if (photoFile) {
        const body = new FormData();
        body.set("file", photoFile);
        try {
          const uploaded = await apiRequest<{
            profilePhoto: string;
            profileThumbnail: string;
            version: number;
          }>(`/api/admin/profiles/${saved.id}/photo`, {
            method: "POST",
            body,
            profileContext: { companyId: company.id, version: currentVersion },
          });
          currentVersion = uploaded.version;
          setVersion(currentVersion);
          uploadedPhoto = uploaded.profilePhoto;
          setPhotoFile(null);
          setPhotoObjectUrl(null);
          setPhotoPath(uploaded.profilePhoto);
        } catch (caught) {
          if (!initialProfile) {
            router.push(
              `/admin/profiles/${saved.id}/edit?notice=photo-error` as Route,
            );
            return;
          }
          throw caught;
        }
      }
      setPhotoPath(uploadedPhoto);
      if (publishAfter) {
        const published = await apiRequest<ProfileView>(
          `/api/admin/profiles/${saved.id}/publish`,
          {
            method: "POST",
            body: {},
            profileContext: { companyId: company.id, version: currentVersion },
          },
        );
        currentVersion = published.version;
        setVersion(currentVersion);
        setStatus(published.status);
      }
      setBaseline(JSON.stringify(draft));
      if (!initialProfile) {
        router.push(`/admin/profiles/${saved.id}/edit?notice=created` as Route);
      } else {
        setMessage(publishAfter ? copy.statusChanged : copy.saved);
        router.refresh();
      }
    } catch (caught) {
      handleError(caught, copy.photoUploadFailed);
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(nextStatus: ProfileStatusValue) {
    if (!initialProfile) return;
    if (nextStatus === "ACTIVE") {
      await submit(undefined, true);
      return;
    }
    if (nextStatus === "ARCHIVED" && !window.confirm(copy.archiveConfirm))
      return;
    setPending(true);
    setError(null);
    try {
      const updated = await apiRequest<ProfileView>(
        `/api/admin/profiles/${initialProfile.id}/status`,
        {
          method: "POST",
          body: { status: nextStatus },
          profileContext: mutationContext,
        },
      );
      setStatus(updated.status);
      setVersion(updated.version);
      setMessage(copy.statusChanged);
      router.refresh();
    } catch (caught) {
      handleError(caught, copy.photoUploadFailed);
    } finally {
      setPending(false);
    }
  }

  const fullName =
    draft.displayName ||
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Nama Karyawan";
  const sectionLabels: Record<ProfileSection, string> = {
    CONTACT: copy.contactSection,
    SOCIAL: copy.socialSection,
    ADDRESS: copy.addressSection,
    BIO: copy.bioSection,
  };

  const previewProfile = presentProfile(
    {
      ...draft,
      displayName: fullName,
      slug: draft.slug || "preview",
      profilePhoto: removePhotoRequested ? null : photoPath,
      company,
      socialLinks: draft.socialLinks.map((link) => ({
        ...link,
        id: link.clientId,
      })),
    },
    (id) => id,
    photoObjectUrl ?? undefined,
  );
  return (
    <>
      <div className="page-header profile-editor-header">
        <div>
          <Link className="back-link" href="/admin/profiles">
            <ArrowLeft size={15} />
            {copy.back}
          </Link>
          <div className="profile-title-line">
            <h1>{initialProfile ? copy.edit : copy.add}</h1>
            {initialProfile ? (
              <ProfileStatusBadge
                status={status}
                label={statusLabel(status, copy)}
              />
            ) : null}
          </div>
          <p>{initialProfile ? copy.editSubtitle : copy.createSubtitle}</p>
        </div>
        {initialProfile ? (
          <div className="profile-status-actions">
            {status !== "ARCHIVED" ? (
              <Link
                className="button button-secondary"
                href={`/admin/profiles/${initialProfile.id}/qr` as Route}
              >
                <QrCode size={16} />
                {copy.qrVcard}
              </Link>
            ) : null}
            {status === "ACTIVE" || status === "INACTIVE" ? (
              <Link
                className="button button-secondary"
                href={`/c/${initialProfile.slug}` as Route}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} />
                {copy.viewPublic}
              </Link>
            ) : null}
            {status === "DRAFT" || status === "INACTIVE" ? (
              <button
                className="button button-primary"
                type="button"
                disabled={pending || conflict}
                onClick={() => changeStatus("ACTIVE")}
              >
                <Send size={16} />
                {locale === "id" ? "Simpan & publikasikan" : "Save & publish"}
              </button>
            ) : null}
            {status === "ACTIVE" ? (
              <button
                className="button button-secondary"
                type="button"
                disabled={pending}
                onClick={() => changeStatus("INACTIVE")}
              >
                <EyeOff size={16} />
                {copy.deactivate}
              </button>
            ) : null}
            {status === "ARCHIVED" ? (
              <button
                className="button button-destructive"
                type="button"
                disabled={pending || conflict}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={16} />
                {locale === "id" ? "Hapus permanen" : "Delete permanently"}
              </button>
            ) : null}
            {status === "ARCHIVED" ? (
              <button
                className="button button-secondary"
                type="button"
                disabled={pending}
                onClick={() => changeStatus("DRAFT")}
              >
                <RotateCcw size={16} />
                {copy.restore}
              </button>
            ) : (
              <button
                className="button button-danger"
                type="button"
                disabled={pending}
                onClick={() => changeStatus("ARCHIVED")}
              >
                <Archive size={16} />
                {copy.archive}
              </button>
            )}
          </div>
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
          {conflict ? (
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => window.location.reload()}
            >
              {locale === "id" ? "Muat ulang profil" : "Reload profile"}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="editor-context-bar">
        <span>{company.name}</span>
        <span
          className={dirty ? "save-indicator is-dirty" : "save-indicator"}
          role="status"
        >
          {pending
            ? locale === "id"
              ? "Menyimpan…"
              : "Saving…"
            : dirty
              ? locale === "id"
                ? "Belum disimpan"
                : "Unsaved changes"
              : locale === "id"
                ? "Tidak ada perubahan"
                : "No unsaved changes"}
        </span>
      </div>
      {status === "ACTIVE" ? (
        <p className="editor-public-notice">
          {locale === "id"
            ? "Perubahan yang disimpan pada profil aktif akan langsung tampil di halaman publik."
            : "Saved changes to an active profile appear on its public page immediately."}
        </p>
      ) : null}

      <button
        className="button button-secondary editor-preview-toggle"
        type="button"
        onClick={() => setPreviewOpen(true)}
      >
        <Eye size={17} />
        {copy.preview}
      </button>
      <div className="profile-editor-layout">
        <form
          className="profile-form"
          ref={formRef}
          onSubmit={submit}
          aria-busy={pending}
        >
          <section className="profile-form-section">
            <div className="profile-form-heading">
              <h2>{copy.basic}</h2>
              <p>{company.name}</p>
            </div>
            <div className="form-grid">
              <TextField
                id="profile-prefix"
                name="honorificPrefix"
                error={fieldErrors["honorificPrefix"]?.[0]}
                label={copy.prefix}
                value={draft.honorificPrefix}
                onChange={setField}
                maxLength={30}
              />
              <TextField
                id="profile-suffix"
                name="honorificSuffix"
                error={fieldErrors["honorificSuffix"]?.[0]}
                label={copy.suffix}
                value={draft.honorificSuffix}
                onChange={setField}
                maxLength={30}
              />
              <TextField
                id="profile-first-name"
                name="firstName"
                error={fieldErrors["firstName"]?.[0]}
                label={copy.firstName}
                value={draft.firstName}
                onChange={(name, value) =>
                  setNameField(name as "firstName", value)
                }
                maxLength={100}
                required
              />
              <TextField
                id="profile-last-name"
                name="lastName"
                error={fieldErrors["lastName"]?.[0]}
                label={copy.lastName}
                value={draft.lastName}
                onChange={(name, value) =>
                  setNameField(name as "lastName", value)
                }
                maxLength={100}
              />
              <TextField
                id="profile-display-name"
                name="displayName"
                error={fieldErrors["displayName"]?.[0]}
                label={copy.displayName}
                value={draft.displayName}
                onChange={setField}
                maxLength={120}
                placeholder={fullName}
              />
              <div className="field">
                <label htmlFor="profile-slug">{copy.slug}</label>
                <input
                  name="slug"
                  id="profile-slug"
                  value={draft.slug}
                  required
                  minLength={2}
                  maxLength={100}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  disabled={Boolean(initialProfile?.firstPublishedAt)}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setField("slug", event.target.value.toLowerCase());
                  }}
                />
                <p className="field-hint">
                  {initialProfile?.firstPublishedAt
                    ? locale === "id"
                      ? "Slug dikunci setelah profil dipublikasikan agar QR lama tetap berlaku."
                      : "The slug is locked after publishing so existing QR codes remain valid."
                    : copy.autoSlug}
                </p>
              </div>
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading">
              <h2>{copy.work}</h2>
            </div>
            <div className="form-grid">
              <TextField
                id="profile-job-title"
                name="jobTitle"
                error={fieldErrors["jobTitle"]?.[0]}
                label={copy.jobTitle}
                value={draft.jobTitle}
                onChange={setField}
                maxLength={120}
                required
              />
              <TextField
                id="profile-department"
                name="department"
                error={fieldErrors["department"]?.[0]}
                label={copy.department}
                value={draft.department}
                onChange={setField}
                maxLength={120}
              />
              <TextField
                id="profile-company-name"
                name="companyName"
                error={fieldErrors["companyName"]?.[0]}
                label={copy.companyName}
                value={draft.companyName}
                onChange={setField}
                maxLength={160}
                required
                span
              />
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading">
              <h2>{copy.contact}</h2>
              <p>{copy.internationalPhone}</p>
            </div>
            <div className="form-grid">
              <TextField
                id="profile-email"
                name="email"
                error={fieldErrors["email"]?.[0]}
                label={copy.email}
                value={draft.email}
                onChange={setField}
                type="email"
                maxLength={191}
                required
                span
              />
              <TextField
                id="profile-work-phone"
                name="workPhone"
                error={fieldErrors["workPhone"]?.[0]}
                label={copy.workPhone}
                value={draft.workPhone}
                onChange={setField}
                type="tel"
                maxLength={32}
                placeholder="+62311234567"
              />
              <TextField
                id="profile-mobile-phone"
                name="mobilePhone"
                error={fieldErrors["mobilePhone"]?.[0]}
                label={copy.mobilePhone}
                value={draft.mobilePhone}
                onChange={setField}
                type="tel"
                maxLength={32}
                placeholder="+628123456789"
              />
              <TextField
                id="profile-whatsapp"
                name="whatsappNumber"
                error={fieldErrors["whatsappNumber"]?.[0]}
                label={copy.whatsapp}
                value={draft.whatsappNumber}
                onChange={setField}
                type="tel"
                maxLength={32}
                placeholder="+628123456789"
              />
              <TextField
                id="profile-website"
                name="website"
                error={fieldErrors["website"]?.[0]}
                label={copy.website}
                value={draft.website}
                onChange={setField}
                type="url"
                maxLength={500}
                placeholder="https://"
              />
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading">
              <h2>{copy.address}</h2>
            </div>
            <div className="form-grid">
              <TextField
                id="profile-address-1"
                name="addressLine1"
                error={fieldErrors["addressLine1"]?.[0]}
                label={copy.address1}
                value={draft.addressLine1}
                onChange={setField}
                maxLength={255}
                span
              />
              <TextField
                id="profile-address-2"
                name="addressLine2"
                error={fieldErrors["addressLine2"]?.[0]}
                label={copy.address2}
                value={draft.addressLine2}
                onChange={setField}
                maxLength={255}
                span
              />
              <TextField
                id="profile-city"
                name="city"
                error={fieldErrors["city"]?.[0]}
                label={copy.city}
                value={draft.city}
                onChange={setField}
                maxLength={100}
              />
              <TextField
                id="profile-province"
                name="province"
                error={fieldErrors["province"]?.[0]}
                label={copy.province}
                value={draft.province}
                onChange={setField}
                maxLength={100}
              />
              <TextField
                id="profile-postal-code"
                name="postalCode"
                error={fieldErrors["postalCode"]?.[0]}
                label={copy.postalCode}
                value={draft.postalCode}
                onChange={setField}
                maxLength={20}
              />
              <TextField
                id="profile-country"
                name="country"
                error={fieldErrors["country"]?.[0]}
                label={copy.country}
                value={draft.country}
                onChange={setField}
                maxLength={100}
              />
              <TextField
                id="profile-bio"
                name="shortBio"
                error={fieldErrors["shortBio"]?.[0]}
                label={copy.bio}
                value={draft.shortBio}
                onChange={setField}
                maxLength={2000}
                textarea
                span
              />
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading profile-heading-actions">
              <div>
                <h2>{copy.social}</h2>
                <p>{copy.noSocial}</p>
              </div>
              <button
                className="button button-secondary button-sm"
                type="button"
                onClick={addSocialLink}
                disabled={draft.socialLinks.length >= 20}
              >
                <Plus size={15} />
                {copy.addSocial}
              </button>
            </div>
            <div className="social-editor-list">
              {draft.socialLinks.map((link, index) => (
                <div className="social-editor-row" key={link.clientId}>
                  <div className="social-row-order">
                    <SocialPlatformIcon
                      platform={link.platform}
                      label={link.label || platformLabel(link.platform)}
                      size={18}
                      className="social-editor-brand"
                    />
                    <div className="social-order-buttons">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={copy.moveUp}
                        disabled={index === 0}
                        onClick={() => moveSocialLink(index, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={copy.moveDown}
                        disabled={index === draft.socialLinks.length - 1}
                        onClick={() => moveSocialLink(index, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`social-platform-${link.clientId}`}>
                      {copy.platform}
                    </label>
                    <select
                      id={`social-platform-${link.clientId}`}
                      value={link.platform}
                      onChange={(event) =>
                        updateSocialLink(index, {
                          platform: event.target.value as SocialPlatform,
                        })
                      }
                    >
                      {SOCIAL_PLATFORMS.map((platform) => (
                        <option value={platform} key={platform}>
                          {platformLabel(platform)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`social-label-${link.clientId}`}>
                      {copy.label}
                    </label>
                    <input
                      id={`social-label-${link.clientId}`}
                      value={link.label}
                      required={link.platform === "CUSTOM"}
                      maxLength={80}
                      onChange={(event) =>
                        updateSocialLink(index, { label: event.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`social-username-${link.clientId}`}>
                      {copy.username}
                    </label>
                    <input
                      id={`social-username-${link.clientId}`}
                      value={link.username}
                      maxLength={100}
                      onChange={(event) =>
                        updateSocialLink(index, {
                          username: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field social-url-field">
                    <label htmlFor={`social-url-${link.clientId}`}>
                      {copy.url}
                    </label>
                    <input
                      id={`social-url-${link.clientId}`}
                      value={link.url}
                      type="url"
                      required
                      maxLength={500}
                      placeholder="https://"
                      onChange={(event) =>
                        updateSocialLink(index, { url: event.target.value })
                      }
                    />
                  </div>
                  <label className="checkbox-field social-active">
                    <input
                      type="checkbox"
                      checked={link.isActive}
                      onChange={() =>
                        updateSocialLink(index, { isActive: !link.isActive })
                      }
                    />
                    <span>{copy.visible}</span>
                  </label>
                  <button
                    className="icon-button danger-icon"
                    type="button"
                    aria-label={copy.remove}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        socialLinks: current.socialLinks.filter(
                          (_, position) => position !== index,
                        ),
                      }))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-form-section">
            <div className="profile-form-heading">
              <h2>{copy.appearance}</h2>
            </div>
            <div className="photo-editor-row">
              <div className="photo-editor-preview">
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt=""
                    width={112}
                    height={112}
                    unoptimized
                  />
                ) : (
                  <ImagePlus size={28} />
                )}
              </div>
              <div>
                <p className="field-label">{copy.photo}</p>
                <p className="field-hint">{copy.photoHint}</p>
                <div className="asset-actions">
                  <label className="button button-secondary button-sm">
                    <ImagePlus size={15} />
                    {copy.upload}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={choosePhoto}
                      disabled={pending}
                    />
                  </label>
                  {photoPreview ? (
                    <button
                      className="button button-danger button-sm"
                      type="button"
                      onClick={removePhoto}
                      disabled={pending}
                    >
                      <Trash2 size={15} />
                      {copy.removePhoto}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {removePhotoRequested ? (
              <p className="field-hint">
                {locale === "id"
                  ? "Foto akan dihapus setelah perubahan disimpan."
                  : "The photo will be removed when you save changes."}
              </p>
            ) : null}
            <div className="visibility-grid">
              {(
                [
                  "showPhoto",
                  "showEmail",
                  "showPhone",
                  "showWorkPhone",
                  "showMobilePhone",
                  "showWhatsapp",
                  "showAddress",
                  "showSocialLinks",
                  "allowIndexing",
                ] as const
              ).map((field) => (
                <label className="checkbox-field" key={field}>
                  <input
                    type="checkbox"
                    checked={draft[field]}
                    onChange={() => toggleField(field)}
                  />
                  <span>
                    {
                      {
                        showPhoto: copy.showPhoto,
                        showEmail: copy.showEmail,
                        showPhone: copy.showPhone,
                        showWorkPhone:
                          locale === "id"
                            ? "Tampilkan telepon kantor"
                            : "Show work phone",
                        showMobilePhone:
                          locale === "id"
                            ? "Tampilkan nomor mobile"
                            : "Show mobile phone",
                        showWhatsapp:
                          locale === "id"
                            ? "Tampilkan WhatsApp"
                            : "Show WhatsApp",
                        allowIndexing:
                          locale === "id"
                            ? "Izinkan mesin pencari mengindeks profil"
                            : "Allow search engine indexing",
                        showAddress: copy.showAddress,
                        showSocialLinks: copy.showSocial,
                      }[field]
                    }
                  </span>
                </label>
              ))}
            </div>
            <div className="section-order-editor">
              <p className="field-label">{copy.sectionOrder}</p>
              {draft.sectionOrder.map((section, index) => (
                <div key={section}>
                  <span>
                    {index + 1}. {sectionLabels[section]}
                  </span>
                  <span>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={copy.moveUp}
                      disabled={index === 0}
                      onClick={() => moveSection(index, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={copy.moveDown}
                      disabled={index === draft.sectionOrder.length - 1}
                      onClick={() => moveSection(index, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="profile-form-footer">
            <span className="field-hint">
              {dirty
                ? locale === "id"
                  ? "Periksa perubahan sebelum menyimpan."
                  : "Review your changes before saving."
                : company.name}
            </span>
            <Link className="button button-secondary" href="/admin/profiles">
              {copy.cancel}
            </Link>
            <button
              className="button button-primary"
              type="submit"
              disabled={pending || conflict}
            >
              {pending
                ? copy.saving
                : initialProfile
                  ? copy.saveChanges
                  : copy.saveDraft}
            </button>
          </div>
        </form>

        <aside className="profile-preview-panel">
          <div className="profile-preview-header">
            <div>
              <h2>{copy.preview}</h2>
              <p>{copy.previewHint}</p>
            </div>
            <div
              className="preview-mode-switcher"
              role="group"
              aria-label={copy.preview}
            >
              {(["mobile", "tablet", "desktop"] as const).map((mode) => (
                <button
                  key={mode}
                  className={previewMode === mode ? "is-active" : undefined}
                  type="button"
                  aria-pressed={previewMode === mode}
                  onClick={() => setPreviewMode(mode)}
                >
                  {copy[mode]}
                </button>
              ))}
            </div>
          </div>
          <div className={`preview-stage preview-${previewMode}`}>
            <div className="preview-viewport">
              <PublicProfileCard
                profile={previewProfile}
                locale={locale}
                canonicalUrl={`/c/${draft.slug || "preview"}`}
                preview
              />
            </div>
          </div>
        </aside>
      </div>
      {previewOpen ? (
        <ModalDialog
          titleId="editor-preview-title"
          className="modal preview-dialog"
          onClose={() => setPreviewOpen(false)}
        >
          <div className="modal-header">
            <h2 id="editor-preview-title">{copy.preview}</h2>
            <button
              className="button button-secondary button-sm"
              type="button"
              onClick={() => setPreviewOpen(false)}
            >
              {locale === "id" ? "Tutup" : "Close"}
            </button>
          </div>
          <div className="preview-modal-body">
            <PublicProfileCard
              profile={previewProfile}
              locale={locale}
              canonicalUrl={`/c/${draft.slug || "preview"}`}
              preview
            />
          </div>
        </ModalDialog>
      ) : null}
      {deleteOpen && initialProfile ? (
        <DeleteProfileDialog
          profile={{ ...initialProfile, version }}
          companyId={company.id}
          locale={locale}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            router.replace("/admin/profiles?status=ARCHIVED");
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
