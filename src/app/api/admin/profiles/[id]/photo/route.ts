import { requireProfileMutation } from "@/services/profile-mutation.service";
import type { NextRequest } from "next/server";
import {
  AppError,
  readFormBody,
  routeErrorResponse,
  successResponse,
} from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { requireRequestSession } from "@/services/auth.service";
import {
  removeProfilePhoto,
  uploadProfilePhoto,
} from "@/services/profile-photo.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const mutation = await requireProfileMutation(request, session);
    const form = await readFormBody(request);
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError(
        422,
        "FILE_REQUIRED",
        "Pilih foto yang akan diunggah.",
      );
    }
    const { id } = await context.params;
    return successResponse(
      await uploadProfilePhoto(session, id, file, mutation),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const mutation = await requireProfileMutation(request, session);
    const { id } = await context.params;
    return successResponse(await removeProfilePhoto(session, id, mutation));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
