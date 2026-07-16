import type { NextRequest } from "next/server";
import { routeErrorResponse } from "@/lib/api";
import { vCardDownloadResponse } from "@/lib/vcard-response";
import { requireRequestSession } from "@/services/auth.service";
import { getAdminVCard } from "@/services/vcard.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await context.params;
    const vcard = await getAdminVCard(session, id);
    return vCardDownloadResponse(vcard.slug, vcard.content);
  } catch (error) {
    const response = routeErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }
}
