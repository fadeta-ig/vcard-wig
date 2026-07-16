import type { NextRequest } from "next/server";
import { ProfileStatus } from "@/generated/prisma/client";
import { routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { requireRequestSession } from "@/services/auth.service";
import { changeProfileStatus } from "@/services/profile.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const { id } = await context.params;
    return successResponse(await changeProfileStatus(session, id, ProfileStatus.ACTIVE));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
