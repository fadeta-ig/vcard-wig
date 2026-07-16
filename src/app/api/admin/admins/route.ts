import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { adminCreateSchema } from "@/lib/validation";
import { createAdmin, listAdmins } from "@/services/admin.service";
import { requireSuperAdmin } from "@/services/authorization.service";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    return successResponse(await listAdmins());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSuperAdmin(request);
    assertCsrf(request, session);
    const input = adminCreateSchema.parse(await readJsonBody(request));
    return successResponse(await createAdmin(session, input), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
