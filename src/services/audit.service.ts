import { Prisma, UserRole } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedSession } from "@/services/auth.service";

type AuditInput = {
  userId: string;
  companyId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
};

export function writeAuditLog(input: AuditInput): Promise<unknown> {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      companyId: input.companyId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValues: input.oldValues,
      newValues: input.newValues,
    },
  });
}

const AUDIT_PAGE_SIZE = 25;
const SENSITIVE_KEY = /password|passwd|token|secret|csrf|credential|authorization|cookie|session/i;

export type AuditFilters = {
  search?: string;
  action?: string;
  entityType?: string;
  companyId?: string;
  fromInput?: string;
  toInput?: string;
  from?: Date;
  toExclusive?: Date;
  page: number;
};

function parseJakartaDate(value: string | undefined, endExclusive = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endExclusive) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function scalar(input: string | string[] | undefined): string | undefined {
  const value = Array.isArray(input) ? input[0] : input;
  return value?.trim() || undefined;
}

export function parseAuditFilters(
  input: Record<string, string | string[] | undefined>,
): AuditFilters {
  const search = scalar(input.search)?.slice(0, 100);
  const action = scalar(input.action)?.slice(0, 80);
  const entityType = scalar(input.entityType)?.slice(0, 80);
  const companyId = scalar(input.companyId)?.slice(0, 191);
  const requestedFrom = scalar(input.from);
  const requestedTo = scalar(input.to);
  const from = parseJakartaDate(requestedFrom);
  const toExclusive = parseJakartaDate(requestedTo, true);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(scalar(input.page) ?? "1", 10) || 1));
  return {
    ...(search ? { search } : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(companyId ? { companyId } : {}),
    ...(from ? { from, fromInput: requestedFrom } : {}),
    ...(toExclusive ? { toExclusive, toInput: requestedTo } : {}),
    page,
  };
}

function redactAuditValue(value: Prisma.JsonValue | null | undefined, depth = 0): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (depth >= 5) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactAuditValue(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactAuditValue(child, depth + 1),
    ]),
  );
}

export function formatRedactedAuditValue(value: Prisma.JsonValue | null): string | null {
  if (value === null) return null;
  return JSON.stringify(redactAuditValue(value), null, 2);
}

export async function listAuditLogs(
  session: AuthenticatedSession,
  filters: AuditFilters,
) {
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new AppError(403, "FORBIDDEN", "Audit log hanya tersedia untuk Super Admin.");
  }
  const createdAt = {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.toExclusive ? { lt: filters.toExclusive } : {}),
  };
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(filters.search
      ? {
          OR: [
            { action: { contains: filters.search } },
            { entityType: { contains: filters.search } },
            { entityId: { contains: filters.search } },
            { user: { is: { name: { contains: filters.search } } } },
            { user: { is: { username: { contains: filters.search } } } },
            { company: { is: { name: { contains: filters.search } } } },
          ],
        }
      : {}),
  };
  const [totalRows, actions, entityTypes, companies] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalRows / AUDIT_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const logs = await prisma.auditLog.findMany({
    where,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      oldValues: true,
      newValues: true,
      createdAt: true,
      user: { select: { username: true, name: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
  });
  return {
    logs: logs.map((log) => ({
      ...log,
      oldValues: formatRedactedAuditValue(log.oldValues),
      newValues: formatRedactedAuditValue(log.newValues),
    })),
    options: {
      actions: actions.map((item) => item.action),
      entityTypes: entityTypes.map((item) => item.entityType),
      companies,
    },
    pagination: {
      page,
      pageSize: AUDIT_PAGE_SIZE,
      totalRows,
      totalPages,
    },
  };
}
