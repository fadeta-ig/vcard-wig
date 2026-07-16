import type { NextRequest } from "next/server";
import { routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { requireRequestSession } from "@/services/auth.service";
import { archiveProfile } from "@/services/profile.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const { id } = await context.params;
    return successResponse(await archiveProfile(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
