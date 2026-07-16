import { UserRole } from "@/generated/prisma/client";
import type { z } from "zod";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/password";
import type { adminCreateSchema, adminUpdateSchema } from "@/lib/validation";
import type { AuthenticatedSession } from "@/services/auth.service";

type AdminCreateInput = z.infer<typeof adminCreateSchema>;
type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;

const adminSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  memberships: {
    where: { isActive: true },
    select: {
      company: {
        select: { id: true, name: true, slug: true, isActive: true },
      },
    },
    orderBy: { company: { name: "asc" } },
  },
} as const;

function auditSnapshot(admin: {
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}) {
  return {
    username: admin.username,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    isActive: admin.isActive,
    mustChangePassword: admin.mustChangePassword,
  };
}

async function validateCompanyIds(companyIds: string[]): Promise<string[]> {
  const uniqueIds = [...new Set(companyIds)];
  if (uniqueIds.length === 0) return [];
  const count = await prisma.company.count({ where: { id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) {
    throw new AppError(422, "INVALID_COMPANY_ASSIGNMENT", "Salah satu perusahaan tidak valid.");
  }
  return uniqueIds;
}

export function listAdmins() {
  return prisma.user.findMany({
    select: adminSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getAdmin(adminId: string) {
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: adminSelect });
  if (!admin) throw new AppError(404, "ADMIN_NOT_FOUND", "Admin tidak ditemukan.");
  return admin;
}

export async function createAdmin(session: AuthenticatedSession, input: AdminCreateInput) {
  const role = input.role as UserRole;
  const companyIds = role === UserRole.ADMIN ? await validateCompanyIds(input.companyIds) : [];
  if (role === UserRole.ADMIN && companyIds.length === 0) {
    throw new AppError(
      422,
      "COMPANY_ASSIGNMENT_REQUIRED",
      "Admin harus ditugaskan minimal ke satu perusahaan.",
    );
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (transaction) => {
    const admin = await transaction.user.create({
      data: {
        username: input.username,
        name: input.name,
        email: input.email,
        passwordHash,
        role,
        isActive: true,
        mustChangePassword: true,
        memberships:
          companyIds.length > 0
            ? {
                create: companyIds.map((companyId) => ({ companyId })),
              }
            : undefined,
      },
      select: adminSelect,
    });

    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ADMIN_CREATED",
        entityType: "User",
        entityId: admin.id,
        newValues: {
          ...auditSnapshot(admin),
          companyIds,
        },
      },
    });
    return admin;
  });
}

export async function updateAdmin(
  session: AuthenticatedSession,
  adminId: string,
  input: AdminUpdateInput,
) {
  const existing = await prisma.user.findUnique({
    where: { id: adminId },
    include: { memberships: { where: { isActive: true } } },
  });
  if (!existing) throw new AppError(404, "ADMIN_NOT_FOUND", "Admin tidak ditemukan.");

  if (
    adminId === session.user.id &&
    ((input.isActive !== undefined && !input.isActive) ||
      (input.role !== undefined && input.role !== existing.role))
  ) {
    throw new AppError(
      409,
      "SELF_LOCKOUT_PREVENTED",
      "Anda tidak dapat menonaktifkan atau mengubah role akun sendiri.",
    );
  }

  const targetRole = (input.role as UserRole | undefined) ?? existing.role;
  const targetActive = input.isActive ?? existing.isActive;
  if (
    existing.role === UserRole.SUPER_ADMIN &&
    (targetRole !== UserRole.SUPER_ADMIN || !targetActive)
  ) {
    const remainingSuperAdmins = await prisma.user.count({
      where: {
        id: { not: adminId },
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    if (remainingSuperAdmins === 0) {
      throw new AppError(
        409,
        "LAST_SUPER_ADMIN",
        "Super Admin aktif terakhir tidak dapat dinonaktifkan atau diturunkan rolenya.",
      );
    }
  }

  let companyIds: string[] | undefined;
  if (targetRole === UserRole.SUPER_ADMIN) {
    companyIds = [];
  } else if (input.companyIds) {
    companyIds = await validateCompanyIds(input.companyIds);
  } else if (existing.role === UserRole.SUPER_ADMIN) {
    companyIds = [];
  }

  if (targetRole === UserRole.ADMIN) {
    const effectiveCompanyIds = companyIds ?? existing.memberships.map((item) => item.companyId);
    if (effectiveCompanyIds.length === 0) {
      throw new AppError(
        422,
        "COMPANY_ASSIGNMENT_REQUIRED",
        "Admin harus ditugaskan minimal ke satu perusahaan.",
      );
    }
  }

  return prisma.$transaction(async (transaction) => {
    const admin = await transaction.user.update({
      where: { id: adminId },
      data: {
        name: input.name,
        email: input.email,
        role: targetRole,
        isActive: targetActive,
      },
      select: adminSelect,
    });

    if (companyIds !== undefined) {
      await transaction.userCompanyMembership.deleteMany({ where: { userId: adminId } });
      if (companyIds.length > 0) {
        await transaction.userCompanyMembership.createMany({
          data: companyIds.map((companyId) => ({ userId: adminId, companyId })),
        });
      }
    }

    if (!targetActive) {
      await transaction.session.updateMany({
        where: { userId: adminId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ADMIN_UPDATED",
        entityType: "User",
        entityId: adminId,
        oldValues: {
          ...auditSnapshot(existing),
          companyIds: existing.memberships.map((item) => item.companyId),
        },
        newValues: {
          ...auditSnapshot(admin),
          companyIds:
            companyIds ?? existing.memberships.map((item) => item.companyId),
        },
      },
    });

    return transaction.user.findUniqueOrThrow({ where: { id: adminId }, select: adminSelect });
  });
}

export async function resetAdminPassword(
  session: AuthenticatedSession,
  adminId: string,
  password: string,
): Promise<void> {
  if (adminId === session.user.id) {
    throw new AppError(
      409,
      "USE_CHANGE_PASSWORD",
      "Gunakan menu ganti password untuk akun Anda sendiri.",
    );
  }

  const target = await prisma.user.findUnique({ where: { id: adminId } });
  if (!target) throw new AppError(404, "ADMIN_NOT_FOUND", "Admin tidak ditemukan.");
  const passwordHash = await hashPassword(password);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: adminId },
      data: { passwordHash, mustChangePassword: true },
    }),
    prisma.session.updateMany({
      where: { userId: adminId, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ADMIN_PASSWORD_RESET",
        entityType: "User",
        entityId: adminId,
        newValues: { mustChangePassword: true, sessionsRevoked: true },
      },
    }),
  ]);
}
