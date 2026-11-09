import { consumeBucket } from "@/lib/security/public-request";
import { AppError } from "@/lib/api";
import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertSameOrigin } from "@/lib/security/request";
import { loginSchema } from "@/lib/validation";
import {
  authenticateUser,
  sessionPublicData,
  setAuthCookies,
} from "@/services/auth.service";

let inFlight = 0;

export async function POST(request: NextRequest) {
  let claimed = false;
  try {
    assertSameOrigin(request);
    await consumeBucket("auth:application", 200, 60);
    if (inFlight >= 4)
      throw new AppError(
        429,
        "LOGIN_BUSY",
        "Login sedang sibuk. Coba kembali sebentar lagi.",
        { retryAfterSeconds: 3 },
      );
    inFlight += 1;
    claimed = true;
    const input = loginSchema.parse(await readJsonBody(request, 4096));
    const bundle = await authenticateUser(
      input.identifier,
      input.password,
      input.mfaCode,
    );
    const response = successResponse(sessionPublicData(bundle.session));
    setAuthCookies(response, bundle);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return routeErrorResponse(error);
  } finally {
    if (claimed) inFlight -= 1;
  }
}
