"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { translate } from "@/i18n/messages";
import { ApiClientError, apiRequest } from "@/lib/api-client";

type LoginResponse = {
  user: {
    mustChangePassword: boolean;
  };
};

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const result = await apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: {
          identifier: form.get("identifier"),
          password: form.get("password"),
        },
      });
      router.replace(result.user.mustChangePassword ? "/admin/change-password" : "/admin");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(
          caught.code === "LOGIN_RATE_LIMITED"
            ? translate(locale, "auth.rateLimited")
            : caught.code === "INVALID_CREDENTIALS"
              ? translate(locale, "auth.invalid")
              : caught.message,
        );
      } else {
        setError(translate(locale, "common.error"));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1>{translate(locale, "auth.loginTitle")}</h1>
      <p className="muted">{translate(locale, "auth.loginSubtitle")}</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="identifier">{translate(locale, "auth.identifier")}</label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            maxLength={191}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">{translate(locale, "auth.password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={256}
            required
          />
        </div>
        <button className="button button-primary" type="submit" disabled={pending}>
          <LogIn size={17} aria-hidden="true" />
          {pending ? translate(locale, "auth.loggingIn") : translate(locale, "auth.login")}
        </button>
      </form>
    </>
  );
}
