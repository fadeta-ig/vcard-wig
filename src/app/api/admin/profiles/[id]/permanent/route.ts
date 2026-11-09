import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { requireRequestSession } from "@/services/auth.service";
import { requireProfileMutation } from "@/services/profile-mutation.service";
import { permanentlyDeleteProfile } from "@/services/profile.service";

const confirmationSchema = z
  .object({ confirmation: z.string().trim().min(2).max(100) })
  .strict();

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRequestSession(request);
    assertCsrf(request, session);
    const mutation = await requireProfileMutation(request, session);
    const { confirmation } = confirmationSchema.parse(
      await readJsonBody(request, 2048),
    );
    const { id } = await context.params;
    return successResponse(
      await permanentlyDeleteProfile(session, id, confirmation, mutation),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
