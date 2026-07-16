import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { adminUpdateSchema } from "@/lib/validation";
import { getAdmin, updateAdmin } from "@/services/admin.service";
import { requireSuperAdmin } from "@/services/authorization.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireSuperAdmin(request);
    const { id } = await context.params;
    return successResponse(await getAdmin(id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSuperAdmin(request);
    assertCsrf(request, session);
    const input = adminUpdateSchema.parse(await readJsonBody(request));
    const { id } = await context.params;
    return successResponse(await updateAdmin(session, id, input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
