import type { NextRequest } from "next/server";
import { AppError } from "@/lib/api";
import { getEnvironment } from "@/lib/env";
import { safeTokenMatches } from "@/lib/security/crypto";
import type { AuthenticatedSession } from "@/services/auth.service";

export const REQUEST_MARKER_HEADER = "x-vcard-request";
export const CSRF_HEADER = "x-csrf-token";

export function assertSameOrigin(request: NextRequest): void {
  const expectedOrigin = new URL(getEnvironment().APP_URL).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    throw new AppError(403, "CROSS_ORIGIN_REQUEST", "Permintaan lintas origin ditolak.");
  }

  if (!origin || origin !== expectedOrigin) {
    throw new AppError(403, "INVALID_ORIGIN", "Origin permintaan tidak valid.");
  }

  if (request.headers.get(REQUEST_MARKER_HEADER) !== "1") {
    throw new AppError(403, "INVALID_REQUEST", "Header keamanan permintaan tidak tersedia.");
  }
}

export function assertCsrf(request: NextRequest, session: AuthenticatedSession): void {
  assertSameOrigin(request);
  const token = request.headers.get(CSRF_HEADER);

  if (!token || !safeTokenMatches(token, session.csrfTokenHash)) {
    throw new AppError(403, "INVALID_CSRF_TOKEN", "Token keamanan tidak valid atau telah kedaluwarsa.");
  }
}
