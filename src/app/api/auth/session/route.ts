import type { NextRequest } from "next/server";
import { routeErrorResponse, successResponse } from "@/lib/api";
import {
  requireRequestSession,
  sessionPublicData,
} from "@/services/auth.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRequestSession(request, { allowPasswordChangePending: true });
    const response = successResponse(sessionPublicData(session));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return routeErrorResponse(error);
  }
}
