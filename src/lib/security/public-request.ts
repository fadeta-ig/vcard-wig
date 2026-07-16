import type { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { secureCookiesEnabled } from "@/lib/security/auth-constants";
import { createOpaqueToken, hashToken } from "@/lib/security/crypto";

export const VISITOR_COOKIE_NAME = "vcard_visitor";
const VISITOR_TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

export type VisitorIdentity = {
  tokenHash: string;
  newToken?: string;
};

export function visitorIdentity(request: NextRequest): VisitorIdentity {
  const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (existing && VISITOR_TOKEN.test(existing)) return { tokenHash: hashToken(existing) };
  const newToken = createOpaqueToken();
  return { tokenHash: hashToken(newToken), newToken };
}

export function setVisitorCookie(response: NextResponse, identity: VisitorIdentity): void {
  if (!identity.newToken) return;
  response.cookies.set(VISITOR_COOKIE_NAME, identity.newToken, {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

type RateLimitPolicy = {
  visitorLimit: number;
  globalLimit: number;
  windowSeconds: number;
};

const POLICIES: Record<"profile" | "vcard" | "event", RateLimitPolicy> = {
  profile: { visitorLimit: 120, globalLimit: 1_200, windowSeconds: 60 },
  vcard: { visitorLimit: 20, globalLimit: 300, windowSeconds: 60 },
  event: { visitorLimit: 90, globalLimit: 1_500, windowSeconds: 60 },
};

async function consumeBucket(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const keyHash = hashToken(`public-rate-limit:${key}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1_000);

  const bucket = await prisma.$transaction(async (transaction) => {
    const reset = await transaction.publicRateLimit.updateMany({
      where: { keyHash, expiresAt: { lte: now } },
      data: { windowStartedAt: now, requestCount: 1, expiresAt },
    });
    if (reset.count > 0) return { requestCount: 1, expiresAt };

    return transaction.publicRateLimit.upsert({
      where: { keyHash },
      create: { keyHash, windowStartedAt: now, requestCount: 1, expiresAt },
      update: { requestCount: { increment: 1 } },
      select: { requestCount: true, expiresAt: true },
    });
  });

  if (bucket.requestCount > limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.expiresAt.getTime() - Date.now()) / 1_000),
    );
    throw new AppError(
      429,
      "PUBLIC_RATE_LIMITED",
      "Terlalu banyak permintaan. Silakan coba kembali beberapa saat lagi.",
      { retryAfterSeconds },
    );
  }
}

export async function assertPublicRateLimit(
  kind: keyof typeof POLICIES,
  scope: string,
  identity: VisitorIdentity,
): Promise<void> {
  const policy = POLICIES[kind];
  await consumeBucket(
    `${kind}:visitor:${identity.tokenHash}`,
    policy.visitorLimit,
    policy.windowSeconds,
  );
  await consumeBucket(
    `${kind}:global:${scope.slice(0, 160)}`,
    policy.globalLimit,
    policy.windowSeconds,
  );
}

export function analyticsRequestShouldBeIgnored(request: NextRequest): boolean {
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`;
  if (/prefetch|prerender/i.test(purpose) || request.headers.has("next-router-prefetch")) return true;
  const userAgent = request.headers.get("user-agent") ?? "";
  return /bot\b|crawler|spider|slurp|preview|facebookexternalhit|whatsapp|telegrambot|headless/i.test(
    userAgent,
  );
}

export function analyticsRequestMetadata(request: NextRequest): {
  userAgent: string | null;
  referrer: string | null;
} {
  const userAgent = request.headers.get("user-agent")?.trim().slice(0, 500) || null;
  const rawReferrer = request.headers.get("referer");
  let referrer: string | null = null;
  if (rawReferrer) {
    try {
      const parsed = new URL(rawReferrer);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        referrer = `${parsed.origin}${parsed.pathname}`.slice(0, 500);
      }
    } catch {
      referrer = null;
    }
  }
  return { userAgent, referrer };
}

