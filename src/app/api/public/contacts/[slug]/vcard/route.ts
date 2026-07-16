import type { NextRequest } from "next/server";
import { routeErrorResponse } from "@/lib/api";
import {
  analyticsRequestMetadata,
  analyticsRequestShouldBeIgnored,
  assertPublicRateLimit,
  setVisitorCookie,
  visitorIdentity,
} from "@/lib/security/public-request";
import { vCardDownloadResponse } from "@/lib/vcard-response";
import { recordVCardDownload } from "@/services/analytics-event.service";
import { getPublicVCard } from "@/services/vcard.service";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const identity = visitorIdentity(request);
  try {
    const { slug } = await context.params;
    await assertPublicRateLimit("vcard", slug, identity);
    const vcard = await getPublicVCard(slug);
    if (!analyticsRequestShouldBeIgnored(request)) {
      await recordVCardDownload(vcard.profileId, {
        visitorTokenHash: identity.tokenHash,
        ...analyticsRequestMetadata(request),
      }).catch((error: unknown) => console.error("Gagal merekam download vCard", error));
    }
    const response = vCardDownloadResponse(vcard.slug, vcard.content);
    setVisitorCookie(response, identity);
    return response;
  } catch (error) {
    const response = routeErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    setVisitorCookie(response, identity);
    return response;
  }
}
