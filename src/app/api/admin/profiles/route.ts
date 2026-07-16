import type { NextRequest } from "next/server";
import { AppError, readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { profileCreateSchema, profileListQuerySchema } from "@/lib/validation";
import { resolveSelectedCompany } from "@/services/authorization.service";
import { requireRequestSession } from "@/services/auth.service";
import { createProfile, listProfiles } from "@/services/profile.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    const company = await resolveSelectedCompany(session);
    if (!company) {
      throw new AppError(409, "COMPANY_REQUIRED", "Pilih atau buat perusahaan terlebih dahulu.");
    }
    const input = profileListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return successResponse(await listProfiles(session, company.id, input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const company = await resolveSelectedCompany(session);
    if (!company) {
      throw new AppError(409, "COMPANY_REQUIRED", "Pilih atau buat perusahaan terlebih dahulu.");
    }
    const input = profileCreateSchema.parse(await readJsonBody(request));
    return successResponse(await createProfile(session, company.id, input), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
