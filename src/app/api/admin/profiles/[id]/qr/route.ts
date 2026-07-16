import type { NextRequest } from "next/server";
import { AppError, routeErrorResponse } from "@/lib/api";
import { requireRequestSession } from "@/services/auth.service";
import { generateProfileQr } from "@/services/qr.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRequestSession(request);
    const { id } = await context.params;
    const downloadValue = request.nextUrl.searchParams.get("download");
    if (downloadValue !== null && downloadValue !== "true" && downloadValue !== "false") {
      throw new AppError(422, "QR_DISPOSITION_INVALID", "Parameter download tidak valid.");
    }
    const queryParams = new URLSearchParams(request.nextUrl.searchParams);
    queryParams.delete("download");
    const query = Object.fromEntries(queryParams.entries());
    const qr = await generateProfileQr(session, id, query);
    const body = typeof qr.body === "string" ? qr.body : new Uint8Array(qr.body);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": `${qr.contentType}${qr.contentType === "image/svg+xml" ? "; charset=utf-8" : ""}`,
        "Content-Disposition": `${downloadValue === "true" ? "attachment" : "inline"}; filename="${qr.fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": "default-src 'none'; img-src data:",
        "X-Content-Type-Options": "nosniff",
        ETag: `"${qr.fingerprint}"`,
        "X-QR-Cache": qr.cacheHit ? "HIT" : "MISS",
      },
    });
  } catch (error) {
    const response = routeErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }
}
