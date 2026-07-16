import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  isUploadCategory,
  resolveUploadSegments,
} from "@/lib/upload-storage";

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

function assetHeaders(contentType: string, contentLength: number): HeadersInit {
  return {
    "Content-Type": contentType,
    "Content-Length": String(contentLength),
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
}

function isMissingFile(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return ["ENOENT", "ENOTDIR", "EISDIR"].includes(String((error as { code?: string }).code));
}

async function uploadResponse(context: RouteContext, includeBody: boolean): Promise<Response> {
  const { path: pathSegments } = await context.params;
  const [categoryValue, ...assetSegments] = pathSegments;
  if (!categoryValue || !isUploadCategory(categoryValue)) return unavailable();

  const filePath = resolveUploadSegments(categoryValue, assetSegments);
  if (!filePath) return unavailable();
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) return unavailable();

  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_ASSET_SIZE) {
      return unavailable();
    }
    if (!includeBody) {
      return new Response(null, { status: 200, headers: assetHeaders(contentType, metadata.size) });
    }
    const contents = await readFile(filePath);
    if (contents.byteLength <= 0 || contents.byteLength > MAX_ASSET_SIZE) return unavailable();
    return new Response(new Uint8Array(contents), {
      status: 200,
      headers: assetHeaders(contentType, contents.byteLength),
    });
  } catch (error) {
    if (isMissingFile(error)) return unavailable();
    console.error("Gagal membaca aset upload runtime.");
    return unavailable(500);
  }
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return uploadResponse(context, true);
}

export async function HEAD(_request: Request, context: RouteContext): Promise<Response> {
  return uploadResponse(context, false);
}
