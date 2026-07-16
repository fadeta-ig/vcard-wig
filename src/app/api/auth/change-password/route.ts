import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { changePasswordSchema } from "@/lib/validation";
import { changePassword, requireRequestSession } from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request, { allowPasswordChangePending: true });
    assertCsrf(request, session);
    const input = changePasswordSchema.parse(await readJsonBody(request));
    await changePassword(session, input.currentPassword, input.newPassword);
    return successResponse({ changed: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
