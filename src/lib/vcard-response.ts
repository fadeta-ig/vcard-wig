import { NextResponse } from "next/server";

export function vCardDownloadResponse(slug: string, content: string): NextResponse {
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.vcf"; filename*=UTF-8''${encodeURIComponent(`${slug}.vcf`)}`,
      "Content-Length": String(Buffer.byteLength(content, "utf8")),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
