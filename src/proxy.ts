import { NextResponse, type NextRequest } from "next/server";
import { routeErrorResponse } from "@/lib/api";
import {
  assertPublicRateLimit,
  visitorIdentity,
  setVisitorCookie,
} from "@/lib/security/public-request";

export async function proxy(request: NextRequest) {
  const identity = visitorIdentity(request);
  try {
    const slug = request.nextUrl.pathname.split("/")[2] ?? "";
    await assertPublicRateLimit("page", slug, identity);
    const response = NextResponse.next();
    setVisitorCookie(response, identity);
    return response;
  } catch (error) {
    const response = routeErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    setVisitorCookie(response, identity);
    return response;
  }
}

export const config = { matcher: ["/c/:path*"] };
