import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { companyUpdateSchema } from "@/lib/validation";
import { requireSuperAdmin } from "@/services/authorization.service";
import { getCompany, updateCompany } from "@/services/company.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireSuperAdmin(request);
    const { id } = await context.params;
    return successResponse(await getCompany(id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSuperAdmin(request);
    assertCsrf(request, session);
    const input = companyUpdateSchema.parse(await readJsonBody(request));
    const { id } = await context.params;
    return successResponse(await updateCompany(session, id, input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
