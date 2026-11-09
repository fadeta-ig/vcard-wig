"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/i18n/messages";
import { translate } from "@/i18n/messages";
import { allowEditorNavigation } from "@/components/admin/unsaved-changes";
import { ApiClientError, apiRequest } from "@/lib/api-client";

type CompanyOption = { id: string; name: string; isActive: boolean };

export function CompanySwitcher({
  locale,
  companies,
  selectedId,
}: {
  locale: Locale;
  companies: CompanyOption[];
  selectedId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const activeCompanies = companies.filter((company) => company.isActive);

  async function selectCompany(companyId: string) {
    if (!allowEditorNavigation()) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest("/api/admin/context/company", {
        method: "POST",
        body: { companyId },
      });
      router.push("/admin/profiles");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : locale === "id"
            ? "Perusahaan belum dapat diganti."
            : "Unable to switch company.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="company-switcher">
      <span className="sr-only">{translate(locale, "company.switch")}</span>
      <select
        value={selectedId ?? ""}
        onChange={(event) => selectCompany(event.target.value)}
        disabled={pending || activeCompanies.length === 0}
        aria-label={translate(locale, "company.switch")}
      >
        {activeCompanies.length === 0 ? <option value="">—</option> : null}
        {activeCompanies.map((company) => (
          <option value={company.id} key={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="field-error">
          {error}
        </span>
      ) : null}
    </label>
  );
}
