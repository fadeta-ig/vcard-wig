"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { LogoutButton } from "@/components/admin/logout-button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import type { Locale } from "@/i18n/messages";

export function MobileNavigation({
  locale,
  role,
}: {
  locale: Locale;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="icon-button mobile-navigation-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          locale === "id" ? "Buka menu navigasi" : "Open navigation menu"
        }
        aria-expanded={open}
      >
        <Menu size={22} />
      </button>
      {open ? (
        <ModalDialog
          className="mobile-navigation-dialog"
          titleId="mobile-navigation-title"
          onClose={() => setOpen(false)}
        >
          <div className="modal-header">
            <h2 id="mobile-navigation-title">Corporate vCard</h2>
            <button
              className="icon-button"
              type="button"
              aria-label={locale === "id" ? "Tutup menu" : "Close menu"}
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <AdminNavigation
            locale={locale}
            role={role}
            onNavigate={() => setOpen(false)}
          />
          <div className="mobile-navigation-footer">
            <LogoutButton locale={locale} />
          </div>
        </ModalDialog>
      ) : null}
    </>
  );
}
