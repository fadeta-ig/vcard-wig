"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/i18n/messages";
import { translate } from "@/i18n/messages";
import { apiRequest } from "@/lib/api-client";

export function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <button
      className="button button-quiet button-sm"
      type="button"
      onClick={logout}
      disabled={pending}
    >
      <LogOut size={16} aria-hidden="true" />
      {translate(locale, "auth.logout")}
    </button>
  );
}
