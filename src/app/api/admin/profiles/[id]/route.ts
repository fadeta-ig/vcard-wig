import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { profileUpdateSchema } from "@/lib/validation";
import { requireRequestSession } from "@/services/auth.service";
import {
  archiveProfile,
  getProfileForSession,
  updateProfile,
} from "@/services/profile.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await context.params;
    return successResponse(await getProfileForSession(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const input = profileUpdateSchema.parse(await readJsonBody(request));
    const { id } = await context.params;
    return successResponse(await updateProfile(session, id, input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const { id } = await context.params;
    return successResponse(await archiveProfile(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
