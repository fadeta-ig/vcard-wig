import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { socialLinkCreateSchema } from "@/lib/validation";
import { requireRequestSession } from "@/services/auth.service";
import { createSocialLink } from "@/services/profile.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const input = socialLinkCreateSchema.parse(await readJsonBody(request));
    const { id } = await context.params;
    return successResponse(await createSocialLink(session, id, input), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
