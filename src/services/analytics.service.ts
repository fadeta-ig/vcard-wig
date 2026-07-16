import {
  ActivityEventType,
  Prisma,
  ProfileStatus,
  UserRole,
} from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedSession } from "@/services/auth.service";

export const ANALYTICS_EVENT_TYPES = Object.values(ActivityEventType);
const ANALYTICS_PAGE_SIZE = 20;

export type AnalyticsScope = {
  kind: "company" | "global";
  companyId: string | null;
  label: string;
};

export type AnalyticsFilters = {
  from: Date;
  toExclusive: Date;
  fromInput: string;
  toInput: string;
  eventType?: ActivityEventType;
  profileId?: string;
  page: number;
};

function jakartaDateInput(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDateInput(value: string | undefined, endExclusive = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime()) || jakartaDateInput(date) !== value) return undefined;
  if (endExclusive) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export function parseAnalyticsFilters(
  input: Record<string, string | string[] | undefined>,
): AnalyticsFilters {
  const now = new Date();
  const defaultToInput = jakartaDateInput(now);
  const defaultFrom = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1_000);
  const defaultFromInput = jakartaDateInput(defaultFrom);
  const requestedFrom = Array.isArray(input.from) ? input.from[0] : input.from;
  const requestedTo = Array.isArray(input.to) ? input.to[0] : input.to;
  const fromInput = parseDateInput(requestedFrom) ? requestedFrom! : defaultFromInput;
  const toInput = parseDateInput(requestedTo, true) ? requestedTo! : defaultToInput;
  const from = parseDateInput(fromInput)!;
  const toExclusive = parseDateInput(toInput, true)!;
  const maximumRangeMs = 366 * 24 * 60 * 60 * 1_000;
  const normalizedFrom =
    from < toExclusive && toExclusive.getTime() - from.getTime() <= maximumRangeMs
      ? from
      : new Date(toExclusive.getTime() - 29 * 24 * 60 * 60 * 1_000);
  const eventInput = Array.isArray(input.eventType) ? input.eventType[0] : input.eventType;
  const profileInput = Array.isArray(input.profileId) ? input.profileId[0] : input.profileId;
  const pageInput = Array.isArray(input.page) ? input.page[0] : input.page;
  return {
    from: normalizedFrom,
    toExclusive,
    fromInput: jakartaDateInput(normalizedFrom),
    toInput,
    ...(ANALYTICS_EVENT_TYPES.includes(eventInput as ActivityEventType)
      ? { eventType: eventInput as ActivityEventType }
      : {}),
    ...(profileInput && profileInput.length <= 191 ? { profileId: profileInput } : {}),
    page: Math.max(1, Math.min(10_000, Number.parseInt(pageInput ?? "1", 10) || 1)),
  };
}

export function resolveAnalyticsScope(
  session: AuthenticatedSession,
  selectedCompany: { id: string; name: string } | null,
  requestedScope: string | undefined,
): AnalyticsScope {
  if (requestedScope === "global") {
    if (session.user.role !== UserRole.SUPER_ADMIN) {
      throw new AppError(403, "FORBIDDEN", "Agregat global hanya tersedia untuk Super Admin.");
    }
    return { kind: "global", companyId: null, label: "Semua perusahaan" };
  }
  if (!selectedCompany) {
    return { kind: "company", companyId: null, label: "Perusahaan belum dipilih" };
  }
  return { kind: "company", companyId: selectedCompany.id, label: selectedCompany.name };
}

function profileWhere(scope: AnalyticsScope): Prisma.ContactProfileWhereInput {
  if (scope.kind === "company" && !scope.companyId) return { id: "__no_company__" };
  return scope.companyId ? { companyId: scope.companyId } : {};
}

function eventWhere(
  scope: AnalyticsScope,
  dates?: { from: Date; toExclusive: Date },
): Prisma.ActivityEventWhereInput {
  return {
    ...(scope.companyId ? { contactProfile: { companyId: scope.companyId } } : {}),
    ...(scope.kind === "company" && !scope.companyId
      ? { contactProfileId: "__no_company__" }
      : {}),
    ...(dates ? { createdAt: { gte: dates.from, lt: dates.toExclusive } } : {}),
  };
}

type DailyRaw = { day: Date | string; total: bigint | number };
type TopRaw = {
  id: string;
  displayName: string;
  slug: string;
  companyName: string;
  total: bigint | number;
};

export async function getDashboardData(scope: AnalyticsScope) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const fourteenDaysAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1_000);
  fourteenDaysAgo.setUTCHours(0, 0, 0, 0);
  const companySql = scope.companyId
    ? Prisma.sql`AND p.companyId = ${scope.companyId}`
    : scope.kind === "company"
      ? Prisma.sql`AND 1 = 0`
      : Prisma.empty;

  const [statusGroups, recentProfiles, eventsThirtyDays, eventGroups, dailyRaw, topRaw] =
    await Promise.all([
      prisma.contactProfile.groupBy({
        by: ["status"],
        where: profileWhere(scope),
        _count: { _all: true },
      }),
      prisma.contactProfile.findMany({
        where: profileWhere(scope),
        select: {
          id: true,
          slug: true,
          displayName: true,
          jobTitle: true,
          status: true,
          createdAt: true,
          company: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.activityEvent.count({
        where: eventWhere(scope, { from: thirtyDaysAgo, toExclusive: now }),
      }),
      prisma.activityEvent.groupBy({
        by: ["eventType"],
        where: eventWhere(scope, { from: thirtyDaysAgo, toExclusive: now }),
        _count: { _all: true },
      }),
      prisma.$queryRaw<DailyRaw[]>(Prisma.sql`
        SELECT DATE(e.createdAt) AS day, COUNT(*) AS total
        FROM ActivityEvent e
        INNER JOIN ContactProfile p ON p.id = e.contactProfileId
        WHERE e.createdAt >= ${fourteenDaysAgo} ${companySql}
        GROUP BY DATE(e.createdAt)
        ORDER BY day ASC
      `),
      prisma.$queryRaw<TopRaw[]>(Prisma.sql`
        SELECT p.id, p.displayName, p.slug, p.companyName, COUNT(e.id) AS total
        FROM ContactProfile p
        INNER JOIN ActivityEvent e ON e.contactProfileId = p.id
        WHERE e.createdAt >= ${thirtyDaysAgo} ${companySql}
        GROUP BY p.id, p.displayName, p.slug, p.companyName
        ORDER BY total DESC, p.displayName ASC
        LIMIT 5
      `),
    ]);

  const statusCounts = Object.fromEntries(
    Object.values(ProfileStatus).map((status) => [status, 0]),
  ) as Record<ProfileStatus, number>;
  for (const group of statusGroups) statusCounts[group.status] = group._count._all;
  const totalProfiles = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const eventCounts = Object.fromEntries(
    Object.values(ActivityEventType).map((eventType) => [eventType, 0]),
  ) as Record<ActivityEventType, number>;
  for (const group of eventGroups) eventCounts[group.eventType] = group._count._all;

  const dailyMap = new Map(
    dailyRaw.map((row) => [jakartaDateInput(new Date(row.day)), Number(row.total)]),
  );
  const dailyEvents = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now.getTime() - (13 - index) * 24 * 60 * 60 * 1_000);
    const day = jakartaDateInput(date);
    return { day, total: dailyMap.get(day) ?? 0 };
  });

  return {
    totalProfiles,
    activeProfiles: statusCounts.ACTIVE,
    inactiveProfiles: statusCounts.INACTIVE,
    draftProfiles: statusCounts.DRAFT,
    archivedProfiles: statusCounts.ARCHIVED,
    eventsThirtyDays,
    eventCounts,
    dailyEvents,
    recentProfiles,
    topProfiles: topRaw.map((row) => ({ ...row, total: Number(row.total) })),
  };
}

export async function getAnalyticsReport(
  scope: AnalyticsScope,
  filters: AnalyticsFilters,
  options: { allRows?: boolean } = {},
) {
  const baseWhere: Prisma.ActivityEventWhereInput = {
    ...eventWhere(scope, { from: filters.from, toExclusive: filters.toExclusive }),
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    ...(filters.profileId ? { contactProfileId: filters.profileId } : {}),
  };
  if (filters.profileId) {
    const allowed = await prisma.contactProfile.count({
      where: { ...profileWhere(scope), id: filters.profileId },
    });
    if (!allowed) throw new AppError(404, "PROFILE_NOT_FOUND", "Profil tidak ditemukan.");
  }

  const [groups, availableProfiles] = await Promise.all([
    prisma.activityEvent.groupBy({
      by: ["contactProfileId", "eventType"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.contactProfile.findMany({
      where: profileWhere(scope),
      select: { id: true, displayName: true, slug: true, company: { select: { name: true } } },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const profileMap = new Map(availableProfiles.map((profile) => [profile.id, profile]));
  const rowMap = new Map<
    string,
    {
      profileId: string;
      displayName: string;
      slug: string;
      companyName: string;
      counts: Record<ActivityEventType, number>;
      total: number;
    }
  >();
  const summary = Object.fromEntries(
    ANALYTICS_EVENT_TYPES.map((eventType) => [eventType, 0]),
  ) as Record<ActivityEventType, number>;
  for (const group of groups) {
    const profile = profileMap.get(group.contactProfileId);
    if (!profile) continue;
    const row = rowMap.get(profile.id) ?? {
      profileId: profile.id,
      displayName: profile.displayName,
      slug: profile.slug,
      companyName: profile.company.name,
      counts: Object.fromEntries(
        ANALYTICS_EVENT_TYPES.map((eventType) => [eventType, 0]),
      ) as Record<ActivityEventType, number>,
      total: 0,
    };
    row.counts[group.eventType] = group._count._all;
    row.total += group._count._all;
    summary[group.eventType] += group._count._all;
    rowMap.set(profile.id, row);
  }
  const allRows = [...rowMap.values()].sort(
    (first, second) => second.total - first.total || first.displayName.localeCompare(second.displayName),
  );
  const totalPages = Math.max(1, Math.ceil(allRows.length / ANALYTICS_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const rows = options.allRows
    ? allRows
    : allRows.slice((page - 1) * ANALYTICS_PAGE_SIZE, page * ANALYTICS_PAGE_SIZE);
  return {
    rows,
    availableProfiles,
    summary,
    totalEvents: Object.values(summary).reduce((sum, count) => sum + count, 0),
    pagination: { page, pageSize: ANALYTICS_PAGE_SIZE, totalRows: allRows.length, totalPages },
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function analyticsCsv(
  rows: Awaited<ReturnType<typeof getAnalyticsReport>>["rows"],
): string {
  const headers = ["Profile", "Company", "Slug", ...ANALYTICS_EVENT_TYPES, "TOTAL"];
  const body = rows.map((row) => [
    row.displayName,
    row.companyName,
    row.slug,
    ...ANALYTICS_EVENT_TYPES.map((eventType) => row.counts[eventType]),
    row.total,
  ]);
  return `\uFEFF${[headers, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

