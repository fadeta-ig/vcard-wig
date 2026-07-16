import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileManager } from "@/components/admin/profile-manager";
import { getLocale } from "@/i18n/server";
import type { ProfileStatusValue } from "@/lib/profile-options";
import type { ProfileListResultView } from "@/lib/profile-types";
import { profileListQuerySchema } from "@/lib/validation";
import { resolveSelectedCompany } from "@/services/authorization.service";
import { getSessionFromCookies } from "@/services/auth.service";
import { listProfiles } from "@/services/profile.service";

export const metadata: Metadata = { title: "Profiles" };

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProfilesPage({ searchParams }: { searchParams: SearchParameters }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");
  const [locale, company, raw] = await Promise.all([
    getLocale(),
    resolveSelectedCompany(session),
    searchParams,
  ]);
  const parsed = profileListQuerySchema.safeParse({
    page: first(raw.page),
    pageSize: first(raw.pageSize),
    search: first(raw.search),
    status: first(raw.status),
    department: first(raw.department),
    createdFrom: first(raw.createdFrom),
    createdTo: first(raw.createdTo),
    sort: first(raw.sort),
  });
  const query = parsed.success ? parsed.data : profileListQuerySchema.parse({});
  const result = company
    ? await listProfiles(session, company.id, query)
    : {
        items: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
        filters: { departments: [] },
        summary: { total: 0, draft: 0, active: 0, inactive: 0, archived: 0 },
      };
  const serialized: ProfileListResultView = {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      status: item.status as ProfileStatusValue,
      publishedAt: item.publishedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };

  return (
    <ProfileManager
      initialResult={serialized}
      locale={locale}
      company={company ? { id: company.id, name: company.name } : null}
      query={{ ...query, status: query.status as ProfileStatusValue | undefined }}
    />
  );
}
