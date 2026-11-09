import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/services/auth.service";
import { assertCompanyAccess } from "@/services/authorization.service";
import { isUploadCategory, resolveUploadSegments } from "@/lib/upload-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

const MAX_ASSET_SIZE = 5 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function unavailable(status = 404): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function assetHeaders(
  contentType: string,
  contentLength: number,
  privatePhoto: boolean,
): HeadersInit {
  return {
    "Content-Type": contentType,
    "Content-Length": String(contentLength),
    "Cache-Control": privatePhoto
      ? "private, no-store, max-age=0"
      : "public, max-age=31536000, immutable",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
}

function isMissingFile(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error))
    return false;
  return ["ENOENT", "ENOTDIR", "EISDIR"].includes(
    String((error as { code?: string }).code),
  );
}

async function uploadResponse(
  request: Request,
  context: RouteContext,
  includeBody: boolean,
): Promise<Response> {
  const { path: pathSegments } = await context.params;
  const [categoryValue, ...assetSegments] = pathSegments;
  if (!categoryValue || !isUploadCategory(categoryValue)) return unavailable();

  const filePath = resolveUploadSegments(categoryValue, assetSegments);
  if (!filePath) return unavailable();
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) return unavailable();

  try {
    if (categoryValue === "profiles") {
      if (assetSegments.length !== 3) return unavailable();
      const [companyId, profileId] = assetSegments;
      const profile = await prisma.contactProfile.findUnique({
        where: { id: profileId },
        select: {
          companyId: true,
          profilePhoto: true,
          profileThumbnail: true,
          showPhoto: true,
          status: true,
          company: { select: { isActive: true } },
        },
      });
      const requestedPath = `/uploads/profiles/${assetSegments.join("/")}`;
      if (
        !profile ||
        profile.companyId !== companyId ||
        ![profile.profilePhoto, profile.profileThumbnail].includes(
          requestedPath,
        )
      )
        return unavailable();
      const isPublic =
        profile.status === "ACTIVE" &&
        profile.company.isActive &&
        profile.showPhoto;
      if (!isPublic) {
        const session = await getSessionFromRequest(new NextRequest(request));
        if (!session || session.user.mustChangePassword) return unavailable();
        try {
          await assertCompanyAccess(session, profile.companyId);
        } catch {
          return unavailable();
        }
      }
    }
    const metadata = await stat(filePath);
    if (
      !metadata.isFile() ||
      metadata.size <= 0 ||
      metadata.size > MAX_ASSET_SIZE
    ) {
      return unavailable();
    }
    if (!includeBody) {
      return new Response(null, {
        status: 200,
        headers: assetHeaders(
          contentType,
          metadata.size,
          categoryValue === "profiles",
        ),
      });
    }
    const contents = await readFile(filePath);
    if (contents.byteLength <= 0 || contents.byteLength > MAX_ASSET_SIZE)
      return unavailable();
    return new Response(new Uint8Array(contents), {
      status: 200,
      headers: assetHeaders(
        contentType,
        contents.byteLength,
        categoryValue === "profiles",
      ),
    });
  } catch (error) {
    if (isMissingFile(error)) return unavailable();
    console.error("Gagal membaca aset upload runtime.");
    return unavailable(500);
  }
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return uploadResponse(request, context, true);
}

export async function HEAD(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return uploadResponse(request, context, false);
}
