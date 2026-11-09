import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { requireRequestSession } from "@/services/auth.service";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  changeMfa,
} from "@/services/mfa.service";

const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("begin"),
      password: z.string().min(1).max(256),
    })
    .strict(),
  z
    .object({ action: z.literal("confirm"), code: z.string().regex(/^\d{6}$/) })
    .strict(),
  z
    .object({
      action: z.enum(["disable", "recovery"]),
      password: z.string().min(1).max(256),
      code: z.string().min(6).max(64),
    })
    .strict(),
]);
export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const input = schema.parse(await readJsonBody(request, 4096));
    const result =
      input.action === "begin"
        ? await beginMfaEnrollment(session, input.password)
        : input.action === "confirm"
          ? await confirmMfaEnrollment(session, input.code)
          : await changeMfa(session, input.password, input.code, input.action);
    const response = successResponse(result);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const response = routeErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
