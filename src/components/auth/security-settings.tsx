"use client";

import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { Locale } from "@/i18n/messages";

export function SecuritySettings({
  locale,
  enabled,
  configured,
}: {
  locale: Locale;
  enabled: boolean;
  configured: boolean;
}) {
  const id = locale === "id";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<{
    secret: string;
    qrDataUrl: string;
  } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setNotice(null);
    const action = enrollment
      ? "confirm"
      : enabled
        ? String(form.get("action") || "recovery")
        : "begin";
    const body =
      action === "begin"
        ? { action, password: form.get("password") }
        : action === "confirm"
          ? { action, code: form.get("code") }
          : { action, password: form.get("password"), code: form.get("code") };
    try {
      const result = await apiRequest<{
        secret?: string;
        qrDataUrl?: string;
        recoveryCodes?: string[];
      }>("/api/auth/mfa", { method: "POST", body });
      if (result.secret && result.qrDataUrl)
        setEnrollment({ secret: result.secret, qrDataUrl: result.qrDataUrl });
      if (result.recoveryCodes) {
        setCodes(result.recoveryCodes);
        setEnrollment(null);
        setNotice(
          action === "disable"
            ? id
              ? "MFA dinonaktifkan."
              : "MFA disabled."
            : id
              ? "Pengaturan keamanan diperbarui. Simpan kode pemulihan di tempat aman."
              : "Security settings updated. Store recovery codes safely.",
        );
        router.refresh();
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : id
            ? "Pengaturan belum dapat disimpan."
            : "Unable to save settings.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{id ? "Keamanan akun" : "Account security"}</h1>
          <p>
            {id
              ? "Lindungi akses administrasi dengan authenticator dan kode pemulihan."
              : "Protect administrative access with an authenticator and recovery codes."}
          </p>
        </div>
      </div>
      <section className="content-panel security-panel">
        <div className="security-status">
          <ShieldCheck size={24} />
          <div>
            <h2>{id ? "Verifikasi dua langkah" : "Two-step verification"}</h2>
            <p>
              {enabled
                ? id
                  ? "Aktif untuk akun ini"
                  : "Enabled for this account"
                : id
                  ? "Belum diaktifkan"
                  : "Not enabled"}
            </p>
          </div>
        </div>
        {!configured ? (
          <div className="alert alert-warning">
            {id
              ? "MFA memerlukan konfigurasi kunci enkripsi pada server. Hubungi administrator server untuk mengaktifkan layanan ini."
              : "MFA requires a server encryption key. Contact the server administrator to enable this service."}
          </div>
        ) : null}
        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="alert alert-success" role="status">
            {notice}
          </div>
        ) : null}
        {codes.length ? (
          <div className="recovery-codes-panel">
            <h3>
              {id ? "Kode pemulihan sekali pakai" : "Single-use recovery codes"}
            </h3>
            <p>
              {id
                ? "Kode ini hanya ditampilkan sekarang. Simpan di password manager atau tempat aman. Setiap kode hanya dapat digunakan satu kali."
                : "These codes are only displayed now. Store them in a password manager or another safe place. Each code can be used once."}
            </p>
            <ul>
              {codes.map((code) => (
                <li key={code}>
                  <code>{code}</code>
                </li>
              ))}
            </ul>
            <button
              className="button button-secondary"
              onClick={() => setCodes([])}
            >
              {id ? "Saya sudah menyimpan kode" : "I have saved my codes"}
            </button>
          </div>
        ) : null}
        {(configured || enabled) && !codes.length ? (
          <form
            onSubmit={submit}
            className="security-form"
            key={enrollment ? "confirm" : String(enabled)}
          >
            {enrollment ? (
              <>
                <Image
                  src={enrollment.qrDataUrl}
                  alt={
                    id
                      ? "QR untuk aplikasi authenticator"
                      : "QR for authenticator app"
                  }
                  width={240}
                  height={240}
                  unoptimized
                />
                <p>
                  {id
                    ? "Scan QR dengan aplikasi authenticator, lalu masukkan kode 6 digit. Kode pengaturan berlaku 10 menit."
                    : "Scan the QR with your authenticator app, then enter its six-digit code. Setup expires after ten minutes."}
                </p>
                <details>
                  <summary>
                    {id
                      ? "Masukkan kunci secara manual"
                      : "Enter the key manually"}
                  </summary>
                  <code className="mfa-manual-secret">{enrollment.secret}</code>
                </details>
              </>
            ) : (
              <div className="field">
                <label htmlFor="security-password">
                  {id ? "Password saat ini" : "Current password"}
                </label>
                <input
                  id="security-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={256}
                  required
                />
              </div>
            )}
            {enrollment || enabled ? (
              <div className="field">
                <label htmlFor="security-code">
                  {id
                    ? "Kode authenticator atau pemulihan"
                    : "Authenticator or recovery code"}
                </label>
                <input
                  id="security-code"
                  name="code"
                  autoComplete="one-time-code"
                  maxLength={enrollment ? 6 : 64}
                  minLength={6}
                  required
                  pattern={enrollment ? "[0-9]{6}" : undefined}
                />
              </div>
            ) : null}
            {enabled && !enrollment ? (
              <div className="field">
                <label htmlFor="security-action">
                  {id ? "Tindakan" : "Action"}
                </label>
                <select id="security-action" name="action">
                  <option value="recovery">
                    {id
                      ? "Buat ulang kode pemulihan"
                      : "Regenerate recovery codes"}
                  </option>
                  <option value="disable">
                    {id ? "Nonaktifkan MFA" : "Disable MFA"}
                  </option>
                </select>
                <p className="field-hint">
                  {id
                    ? "Kode pemulihan lama akan dibatalkan. Sesi lain akan dikeluarkan setelah perubahan keamanan."
                    : "Old recovery codes will be invalidated. Other sessions will be signed out after security changes."}
                </p>
              </div>
            ) : null}
            <button
              className="button button-primary"
              disabled={pending}
              type="submit"
            >
              {pending
                ? id
                  ? "Memproses…"
                  : "Processing…"
                : enrollment
                  ? id
                    ? "Verifikasi & aktifkan"
                    : "Verify & enable"
                  : enabled
                    ? id
                      ? "Simpan pengaturan"
                      : "Save settings"
                    : id
                      ? "Siapkan authenticator"
                      : "Set up authenticator"}
            </button>
          </form>
        ) : null}
        <Link className="security-password-link" href="/admin/change-password">
          {id ? "Ubah password akun" : "Change account password"}
        </Link>
      </section>
    </>
  );
}
