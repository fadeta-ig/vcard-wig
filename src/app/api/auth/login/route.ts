import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertSameOrigin } from "@/lib/security/request";
import { loginSchema } from "@/lib/validation";
import {
  authenticateUser,
  sessionPublicData,
  setAuthCookies,
} from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = loginSchema.parse(await readJsonBody(request));
    const bundle = await authenticateUser(input.identifier, input.password);
    const response = successResponse(sessionPublicData(bundle.session));
    setAuthCookies(response, bundle);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return routeErrorResponse(error);
  }
}
