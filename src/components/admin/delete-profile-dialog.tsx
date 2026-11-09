"use client";

import { Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import type { Locale } from "@/i18n/messages";

export function DeleteProfileDialog({
  profile,
  companyId,
  locale,
  onClose,
  onDeleted,
}: {
  profile: { id: string; slug: string; displayName: string; version: number };
  companyId: string;
  locale: Locale;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanupPending, setCleanupPending] = useState(false);
  const id = locale === "id";
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await apiRequest<{ assetCleanupPending: boolean }>(
        `/api/admin/profiles/${profile.id}/permanent`,
        {
          method: "DELETE",
          body: { confirmation },
          profileContext: { companyId, version: profile.version },
        },
      );
      if (result.assetCleanupPending) {
        setCleanupPending(true);
        setPending(false);
      } else onDeleted();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : id
            ? "Profil belum dapat dihapus. Coba kembali."
            : "Unable to delete the profile. Please try again.",
      );
      setPending(false);
    }
  }
  if (cleanupPending)
    return (
      <ModalDialog
        titleId="delete-profile-title"
        onClose={onDeleted}
        className="modal modal-sm"
      >
        <div className="modal-header">
          <h2 id="delete-profile-title">
            {id ? "Profil telah dihapus" : "Profile deleted"}
          </h2>
        </div>
        <div className="modal-body">
          <p role="status">
            {id
              ? "Data profil sudah dihapus dan foto tidak dapat diakses. Sebagian berkas foto masih menunggu pembersihan ulang oleh pemeliharaan sistem."
              : "Profile data has been deleted and its photos cannot be accessed. Some photo files are awaiting another system-cleanup attempt."}
          </p>
        </div>
        <div className="modal-footer">
          <button className="button button-primary" onClick={onDeleted}>
            {id ? "Selesai" : "Done"}
          </button>
        </div>
      </ModalDialog>
    );
  return (
    <ModalDialog
      titleId="delete-profile-title"
      onClose={onClose}
      pending={pending}
      className="modal modal-sm"
    >
      <div className="modal-header">
        <div>
          <h2 id="delete-profile-title">
            {id ? "Hapus profil permanen" : "Permanently delete profile"}
          </h2>
          <p>{profile.displayName}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          disabled={pending}
          onClick={onClose}
          aria-label={id ? "Tutup" : "Close"}
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="alert alert-warning">
            {id
              ? "Profil arsip, foto, tautan sosial, dan data aktivitasnya akan dihapus. Tindakan ini tidak dapat dibatalkan. URL lama tetap dicadangkan agar tidak digunakan profil lain."
              : "The archived profile, photos, social links and activity data will be deleted. This cannot be undone. Its old URL remains reserved so another profile cannot use it."}
          </div>
          {error ? (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="delete-profile-confirmation">
              {id
                ? "Ketik slug berikut untuk mengonfirmasi"
                : "Type this slug to confirm"}
              : <strong>{profile.slug}</strong>
            </label>
            <input
              id="delete-profile-confirmation"
              autoComplete="off"
              spellCheck={false}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={pending}
              required
              aria-describedby="delete-profile-hint"
            />
            <p id="delete-profile-hint" className="field-hint">
              {id
                ? "Hanya profil berstatus Arsip yang dapat dihapus permanen."
                : "Only archived profiles can be permanently deleted."}
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
            disabled={pending}
          >
            {id ? "Batal" : "Cancel"}
          </button>
          <button
            className="button button-destructive"
            type="submit"
            disabled={pending || confirmation.trim() !== profile.slug}
          >
            <Trash2 size={16} />
            {pending
              ? id
                ? "Menghapus…"
                : "Deleting…"
              : id
                ? "Hapus permanen"
                : "Delete permanently"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
