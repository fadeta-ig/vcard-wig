import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { adminResetPasswordSchema } from "@/lib/validation";
import { resetAdminPassword } from "@/services/admin.service";
import { requireSuperAdmin } from "@/services/authorization.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSuperAdmin(request);
    assertCsrf(request, session);
    const input = adminResetPasswordSchema.parse(await readJsonBody(request));
    const { id } = await context.params;
    await resetAdminPassword(session, id, input.password);
    return successResponse({ reset: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
