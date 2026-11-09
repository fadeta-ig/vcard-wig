import type { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { resolveSelectedCompany } from "@/services/authorization.service";
import type { AuthenticatedSession } from "@/services/auth.service";

export type ProfileMutationContext = {
  expectedCompanyId?: string;
  expectedVersion?: number;
};

export async function assertEditorCompany(
  session: AuthenticatedSession,
  expectedCompanyId: string,
) {
  const selected = await resolveSelectedCompany(session);
  if (!selected || selected.id !== expectedCompanyId) {
    throw new AppError(
      409,
      "COMPANY_CONTEXT_CHANGED",
      "Perusahaan aktif telah berubah. Buka kembali profil pada perusahaan yang benar sebelum menyimpan.",
    );
  }
  return selected;
}

export function profileMutationHeaders(request: NextRequest): {
  expectedCompanyId: string;
  expectedVersion: number;
} {
  const expectedCompanyId = request.headers.get("x-profile-company") ?? "";
  const version = request.headers.get("x-profile-version") ?? "";
  if (
    !/^[a-zA-Z0-9_-]{1,191}$/.test(expectedCompanyId) ||
    !/^[1-9]\d{0,9}$/.test(version) ||
    Number(version) > 2147483647
  ) {
    throw new AppError(
      428,
      "PROFILE_VERSION_REQUIRED",
      "Muat ulang profil untuk mendapatkan versi terbaru sebelum melakukan perubahan.",
    );
  }
  return { expectedCompanyId, expectedVersion: Number(version) };
}

export async function requireProfileMutation(
  request: NextRequest,
  session: AuthenticatedSession,
) {
  const context = profileMutationHeaders(request);
  await assertEditorCompany(session, context.expectedCompanyId);
  return context;
}

export function assertProfileContext(
  companyId: string,
  context?: ProfileMutationContext,
) {
  if (context?.expectedCompanyId && context.expectedCompanyId !== companyId) {
    throw new AppError(
      409,
      "COMPANY_CONTEXT_CHANGED",
      "Profil ini berada pada perusahaan yang berbeda. Buka kembali profil pada perusahaan yang benar.",
    );
  }
}

export async function claimProfileVersion(
  transaction: Prisma.TransactionClient,
  profile: { id: string; version: number },
  expectedVersion = profile.version,
) {
  const claimed = await transaction.contactProfile.updateMany({
    where: { id: profile.id, version: expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw new AppError(
      409,
      "PROFILE_VERSION_CONFLICT",
      "Profil sudah berubah atau dihapus. Muat ulang dan tinjau perubahan terbaru sebelum mencoba kembali.",
    );
  }
}
