import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { socialLinkUpdateSchema } from "@/lib/validation";
import { requireRequestSession } from "@/services/auth.service";
import { deleteSocialLink, updateSocialLink } from "@/services/profile.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const input = socialLinkUpdateSchema.parse(await readJsonBody(request));
    const { id } = await context.params;
    return successResponse(await updateSocialLink(session, id, input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const { id } = await context.params;
    await deleteSocialLink(session, id);
    return successResponse({ deleted: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
