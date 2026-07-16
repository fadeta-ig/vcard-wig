import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { COMPANY_COOKIE_NAME, secureCookiesEnabled } from "@/lib/security/auth-constants";
import {
  type AuthenticatedSession,
  requireRequestSession,
} from "@/services/auth.service";

export async function requireSuperAdmin(request: NextRequest): Promise<AuthenticatedSession> {
  const session = await requireRequestSession(request);
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new AppError(403, "FORBIDDEN", "Anda tidak memiliki akses ke fungsi ini.");
  }
  return session;
}

export async function listAccessibleCompanies(session: AuthenticatedSession) {
  return prisma.company.findMany({
    where:
      session.user.role === UserRole.SUPER_ADMIN
        ? undefined
        : {
            memberships: {
              some: {
                userId: session.user.id,
                isActive: true,
              },
            },
          },
    select: {
      id: true,
      name: true,
      slug: true,
      companyLogo: true,
      primaryColor: true,
      isActive: true,
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function assertCompanyAccess(
  session: AuthenticatedSession,
  companyId: string,
): Promise<void> {
  if (session.user.role === UserRole.SUPER_ADMIN) {
    const exists = await prisma.company.count({ where: { id: companyId, isActive: true } });
    if (exists) return;
  } else {
    const membership = await prisma.userCompanyMembership.count({
      where: { userId: session.user.id, companyId, isActive: true, company: { isActive: true } },
    });
    if (membership) return;
  }

  throw new AppError(404, "COMPANY_NOT_FOUND", "Perusahaan tidak ditemukan.");
}

export async function resolveSelectedCompany(session: AuthenticatedSession) {
  const companies = await listAccessibleCompanies(session);
  const cookieStore = await cookies();
  const selectedId = cookieStore.get(COMPANY_COOKIE_NAME)?.value;
  const selected = companies.find((company) => company.id === selectedId && company.isActive);
  return selected ?? companies.find((company) => company.isActive) ?? null;
}

export function setCompanyCookie(response: NextResponse, companyId: string): void {
  response.cookies.set(COMPANY_COOKIE_NAME, companyId, {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
