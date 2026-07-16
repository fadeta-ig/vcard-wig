import type { NextRequest } from "next/server";
import { AppError, routeErrorResponse, successResponse } from "@/lib/api";
import {
  assertPublicRateLimit,
  setVisitorCookie,
  visitorIdentity,
} from "@/lib/security/public-request";
import { getPublicProfileBySlug } from "@/services/public-profile.service";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const identity = visitorIdentity(request);
  try {
    const { slug } = await context.params;
    await assertPublicRateLimit("profile", slug, identity);
    const result = await getPublicProfileBySlug(slug);
    if (result.kind === "not_found") {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profil tidak ditemukan.");
    }
    if (result.kind === "inactive") {
      throw new AppError(410, "PROFILE_INACTIVE", "Profil sedang tidak aktif.");
    }
    const response = successResponse(result.profile);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    setVisitorCookie(response, identity);
    return response;
  } catch (error) {
    const response = routeErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    setVisitorCookie(response, identity);
    return response;
  }
}
