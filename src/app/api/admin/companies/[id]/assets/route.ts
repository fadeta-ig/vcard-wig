import type { NextRequest } from "next/server";
import { AppError, readJsonBody, routeErrorResponse, successResponse } from "@/lib/api";
import { assertCsrf } from "@/lib/security/request";
import { requireSuperAdmin } from "@/services/authorization.service";
import {
  removeCompanyAsset,
  uploadCompanyAsset,
  type CompanyAssetType,
} from "@/services/company-asset.service";

type RouteContext = { params: Promise<{ id: string }> };

function assetType(value: FormDataEntryValue | unknown): CompanyAssetType {
  if (value !== "logo" && value !== "favicon") {
    throw new AppError(422, "ASSET_TYPE_INVALID", "Jenis aset tidak valid.");
  }
  return value;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSuperAdmin(request);
    assertCsrf(request, session);
    const formData = await request.formData();
    const type = assetType(formData.get("assetType"));
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError(422, "FILE_REQUIRED", "Pilih file yang akan diunggah.");
    }
    const { id } = await context.params;
    return successResponse(await uploadCompanyAsset(session, id, type, file));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSuperAdmin(request);
    assertCsrf(request, session);
    const input = (await readJsonBody(request)) as { assetType?: unknown };
    const type = assetType(input.assetType);
    const { id } = await context.params;
    await removeCompanyAsset(session, id, type);
    return successResponse({ removed: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
