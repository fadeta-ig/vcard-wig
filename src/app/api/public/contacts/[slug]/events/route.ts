import type { NextRequest } from "next/server";
import { publicEventSchema } from "@/lib/analytics-event";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertSameOrigin } from "@/lib/security/request";
import {
  analyticsRequestMetadata,
  analyticsRequestShouldBeIgnored,
  assertPublicRateLimit,
  setVisitorCookie,
  visitorIdentity,
} from "@/lib/security/public-request";
import { recordClientEvent } from "@/services/analytics-event.service";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const identity = visitorIdentity(request);
  try {
    assertSameOrigin(request);
    const { slug } = await context.params;
    await assertPublicRateLimit("event", slug, identity);
    const input = publicEventSchema.parse(await readJsonBody(request));
    const recorded = analyticsRequestShouldBeIgnored(request)
      ? false
      : await recordClientEvent(slug, input, {
          visitorTokenHash: identity.tokenHash,
          ...analyticsRequestMetadata(request),
        });
    const response = successResponse({ recorded }, 202);
    response.headers.set("Cache-Control", "no-store");
    setVisitorCookie(response, identity);
    return response;
  } catch (error) {
    const response = routeErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    setVisitorCookie(response, identity);
    return response;
  }
}

