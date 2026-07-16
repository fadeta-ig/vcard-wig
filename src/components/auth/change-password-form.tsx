"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { translate } from "@/i18n/messages";
import { ApiClientError, apiRequest } from "@/lib/api-client";

export function ChangePasswordForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
          confirmation: form.get("confirmation"),
        },
      });
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : translate(locale, "common.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1>{translate(locale, "auth.changePasswordTitle")}</h1>
      <p className="muted">{translate(locale, "auth.changePasswordSubtitle")}</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="currentPassword">{translate(locale, "auth.currentPassword")}</label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            maxLength={256}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="newPassword">{translate(locale, "auth.newPassword")}</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirmation">{translate(locale, "auth.confirmPassword")}</label>
          <input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </div>
        <button className="button button-primary" type="submit" disabled={pending}>
          <KeyRound size={17} aria-hidden="true" />
          {translate(locale, "auth.changePassword")}
        </button>
      </form>
    </>
  );
}
