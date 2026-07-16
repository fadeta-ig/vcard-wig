import type { NextRequest } from "next/server";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { companyContextSchema } from "@/lib/validation";
import {
  assertCompanyAccess,
  setCompanyCookie,
} from "@/services/authorization.service";
import { requireRequestSession } from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const input = companyContextSchema.parse(await readJsonBody(request));
    await assertCompanyAccess(session, input.companyId);
    const response = successResponse({ selected: true });
    setCompanyCookie(response, input.companyId);
    return response;
  } catch (error) {
    return routeErrorResponse(error);
  }
}
