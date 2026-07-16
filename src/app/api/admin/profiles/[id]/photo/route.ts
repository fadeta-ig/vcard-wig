import type { NextRequest } from "next/server";
import { AppError, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { requireRequestSession } from "@/services/auth.service";
import { removeProfilePhoto, uploadProfilePhoto } from "@/services/profile-photo.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError(422, "FILE_REQUIRED", "Pilih foto yang akan diunggah.");
    }
    const { id } = await context.params;
    return successResponse(await uploadProfilePhoto(session, id, file));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const { id } = await context.params;
    await removeProfilePhoto(session, id);
    return successResponse({ removed: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
