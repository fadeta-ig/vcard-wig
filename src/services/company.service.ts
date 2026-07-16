import type { z } from "zod";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { companyCreateSchema, companyUpdateSchema } from "@/lib/validation";
import type { AuthenticatedSession } from "@/services/auth.service";

type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;

const companySelect = {
  id: true,
  name: true,
  slug: true,
  legalName: true,
  companyLogo: true,
  favicon: true,
  primaryColor: true,
  secondaryColor: true,
  website: true,
  email: true,
  phone: true,
  address: true,
  qrLogoEnabled: true,
  defaultQrForeground: true,
  defaultQrBackground: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      profiles: true,
      memberships: true,
    },
  },
} as const;

function auditSnapshot(company: {
  name: string;
  slug: string;
  legalName: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  qrLogoEnabled: boolean;
  defaultQrForeground: string;
  defaultQrBackground: string;
  isActive: boolean;
}) {
  return {
    name: company.name,
    slug: company.slug,
    legalName: company.legalName,
    primaryColor: company.primaryColor,
    secondaryColor: company.secondaryColor,
    website: company.website,
    email: company.email,
    phone: company.phone,
    address: company.address,
    qrLogoEnabled: company.qrLogoEnabled,
    defaultQrForeground: company.defaultQrForeground,
    defaultQrBackground: company.defaultQrBackground,
    isActive: company.isActive,
  };
}

export function listCompanies() {
  return prisma.company.findMany({
    select: companySelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: companySelect,
  });
  if (!company) {
    throw new AppError(404, "COMPANY_NOT_FOUND", "Perusahaan tidak ditemukan.");
  }
  return company;
}

export async function createCompany(session: AuthenticatedSession, input: CompanyCreateInput) {
  return prisma.$transaction(async (transaction) => {
    const company = await transaction.company.create({
      data: input,
      select: companySelect,
    });
    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        companyId: company.id,
        action: "COMPANY_CREATED",
        entityType: "Company",
        entityId: company.id,
        newValues: auditSnapshot(company),
      },
    });
    return company;
  });
}

export async function updateCompany(
  session: AuthenticatedSession,
  companyId: string,
  input: CompanyUpdateInput,
) {
  const existing = await prisma.company.findUnique({ where: { id: companyId } });
  if (!existing) {
    throw new AppError(404, "COMPANY_NOT_FOUND", "Perusahaan tidak ditemukan.");
  }

  return prisma.$transaction(async (transaction) => {
    const company = await transaction.company.update({
      where: { id: companyId },
      data: input,
      select: companySelect,
    });
    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        companyId,
        action: "COMPANY_UPDATED",
        entityType: "Company",
        entityId: companyId,
        oldValues: auditSnapshot(existing),
        newValues: auditSnapshot(company),
      },
    });
    return company;
  });
}
