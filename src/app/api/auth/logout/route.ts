import type { NextRequest } from "next/server";
import { routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import {
  clearAuthCookies,
  requireRequestSession,
  revokeSession,
} from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request, { allowPasswordChangePending: true });
    assertCsrf(request, session);
    await revokeSession(session);
    const response = successResponse({ loggedOut: true });
    clearAuthCookies(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const response = routeErrorResponse(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
