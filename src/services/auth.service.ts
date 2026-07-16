import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { getEnvironment } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  COMPANY_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  secureCookiesEnabled,
} from "@/lib/security/auth-constants";
import { createOpaqueToken, hashToken } from "@/lib/security/crypto";
import {
  hashPassword,
  runDummyPasswordVerification,
  verifyPassword,
} from "@/lib/security/password";

const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_LOCK_MS = 15 * 60 * 1_000;
const MAX_LOGIN_FAILURES = 5;
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1_000;

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

export type AuthenticatedSession = {
  id: string;
  csrfTokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
  user: SessionUser;
};

export type SessionBundle = {
  session: AuthenticatedSession;
  sessionToken: string;
  csrfToken: string;
};

function publicUser(user: SessionUser) {
  return {
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export function sessionPublicData(session: AuthenticatedSession) {
  return {
    user: publicUser(session.user),
    expiresAt: session.expiresAt.toISOString(),
  };
}

function normalizedIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

async function assertLoginAllowed(identifierHash: string): Promise<void> {
  const record = await prisma.loginThrottle.findUnique({ where: { identifierHash } });
  if (!record?.lockedUntil || record.lockedUntil <= new Date()) return;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((record.lockedUntil.getTime() - Date.now()) / 1_000),
  );
  throw new AppError(
    429,
    "LOGIN_RATE_LIMITED",
    "Terlalu banyak percobaan login. Silakan coba kembali nanti.",
    { retryAfterSeconds },
  );
}

async function recordLoginFailure(identifierHash: string): Promise<void> {
  const now = new Date();
  const current = await prisma.loginThrottle.findUnique({ where: { identifierHash } });
  const windowExpired =
    !current || now.getTime() - current.windowStartedAt.getTime() >= LOGIN_WINDOW_MS;

  if (windowExpired) {
    await prisma.loginThrottle.upsert({
      where: { identifierHash },
      update: {
        windowStartedAt: now,
        failedAttempts: 1,
        lockedUntil: null,
      },
      create: {
        identifierHash,
        windowStartedAt: now,
        failedAttempts: 1,
      },
    });
    return;
  }

  const failedAttempts = current.failedAttempts + 1;
  await prisma.loginThrottle.update({
    where: { identifierHash },
    data: {
      failedAttempts,
      lockedUntil:
        failedAttempts >= MAX_LOGIN_FAILURES ? new Date(now.getTime() + LOGIN_LOCK_MS) : null,
    },
  });
}

async function clearLoginThrottle(identifierHash: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { identifierHash } });
}

export async function authenticateUser(
  identifierInput: string,
  password: string,
): Promise<SessionBundle> {
  const identifier = normalizedIdentifier(identifierInput);
  const identifierHash = hashToken(identifier);
  await assertLoginAllowed(identifierHash);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  const passwordValid = user
    ? await verifyPassword(user.passwordHash, password)
    : (await runDummyPasswordVerification(password), false);

  if (!user || !passwordValid || !user.isActive) {
    await recordLoginFailure(identifierHash);
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Username/email atau password tidak sesuai.",
    );
  }

  await clearLoginThrottle(identifierHash);

  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + getEnvironment().SESSION_TTL_HOURS * 60 * 60 * 1_000,
  );

  const session = await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });

    const createdSession = await transaction.session.create({
      data: {
        tokenHash: hashToken(sessionToken),
        csrfTokenHash: hashToken(csrfToken),
        userId: user.id,
        expiresAt,
        lastSeenAt: now,
      },
    });

    await transaction.auditLog.create({
      data: {
        userId: user.id,
        action: "AUTH_LOGIN",
        entityType: "Session",
        entityId: createdSession.id,
      },
    });

    return createdSession;
  });

  return {
    session: {
      id: session.id,
      csrfTokenHash: session.csrfTokenHash,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
    },
    sessionToken,
    csrfToken,
  };
}

async function findSession(sessionToken: string | undefined): Promise<AuthenticatedSession | null> {
  if (!sessionToken || sessionToken.length > 200) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(sessionToken) },
    select: {
      id: true,
      csrfTokenHash: true,
      expiresAt: true,
      lastSeenAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;

  if (!session.user.isActive) {
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() >= LAST_SEEN_WRITE_INTERVAL_MS) {
    const lastSeenAt = new Date();
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastSeenAt },
    });
    session.lastSeenAt = lastSeenAt;
  }

  return {
    id: session.id,
    csrfTokenHash: session.csrfTokenHash,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    user: session.user,
  };
}

export function getSessionFromRequest(request: NextRequest): Promise<AuthenticatedSession | null> {
  return findSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function getSessionFromCookies(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies();
  return findSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function requireRequestSession(
  request: NextRequest,
  options?: { allowPasswordChangePending?: boolean },
): Promise<AuthenticatedSession> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Silakan login untuk melanjutkan.");
  }

  if (session.user.mustChangePassword && !options?.allowPasswordChangePending) {
    throw new AppError(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "Password sementara harus diganti sebelum melanjutkan.",
    );
  }

  return session;
}

export function setAuthCookies(response: NextResponse, bundle: SessionBundle): void {
  response.cookies.set(SESSION_COOKIE_NAME, bundle.sessionToken, {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    expires: bundle.session.expiresAt,
    priority: "high",
  });
  response.cookies.set(CSRF_COOKIE_NAME, bundle.csrfToken, {
    httpOnly: false,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    expires: bundle.session.expiresAt,
    priority: "high",
  });
}

export function clearAuthCookies(response: NextResponse): void {
  for (const cookieName of [SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, COMPANY_COOKIE_NAME]) {
    response.cookies.set(cookieName, "", {
      httpOnly: cookieName !== CSRF_COOKIE_NAME,
      secure: secureCookiesEnabled(),
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
  }
}

export async function revokeSession(session: AuthenticatedSession): Promise<void> {
  await prisma.$transaction([
    prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "AUTH_LOGOUT",
        entityType: "Session",
        entityId: session.id,
      },
    }),
  ]);
}

export async function changePassword(
  session: AuthenticatedSession,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AppError(400, "CURRENT_PASSWORD_INVALID", "Password saat ini tidak sesuai.");
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.session.updateMany({
      where: { userId: session.user.id, id: { not: session.id }, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: session.user.id,
        newValues: { mustChangePassword: false },
      },
    }),
  ]);
}
