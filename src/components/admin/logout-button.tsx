"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/i18n/messages";
import { translate } from "@/i18n/messages";
import { allowEditorNavigation } from "@/components/admin/unsaved-changes";
import { apiRequest } from "@/lib/api-client";

export function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function logout() {
    if (!allowEditorNavigation()) return;
    setPending(true);
    setError(false);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="button button-quiet button-sm"
        type="button"
        onClick={logout}
        disabled={pending}
      >
        <LogOut size={16} aria-hidden="true" />
        {translate(locale, "auth.logout")}
      </button>
      {error ? (
        <span role="alert" className="field-error">
          {locale === "id"
            ? "Keluar belum berhasil. Coba kembali."
            : "Sign out failed. Please try again."}
        </span>
      ) : null}
    </>
  );
}
