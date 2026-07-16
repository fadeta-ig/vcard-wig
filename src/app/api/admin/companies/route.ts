import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { companyCreateSchema } from "@/lib/validation";
import { requireSuperAdmin } from "@/services/authorization.service";
import { createCompany, listCompanies } from "@/services/company.service";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    return successResponse(await listCompanies());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSuperAdmin(request);
    assertCsrf(request, session);
    const input = companyCreateSchema.parse(await readJsonBody(request));
    return successResponse(await createCompany(session, input), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
