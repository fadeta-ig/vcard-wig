import { processAssetDeletions } from "@/services/asset-cleanup.service";
import { getEnvironment } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function runRetentionCleanup(now = new Date()) {
  const environment = getEnvironment();
  const eventCutoff = new Date(
    now.getTime() - environment.ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
  );
  const expiredSessionCutoff = new Date(
    now.getTime() -
      environment.EXPIRED_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
  );
  const throttleCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);

  const [events, sessions, publicRateLimits, loginThrottles, dedupe] =
    await prisma.$transaction([
      prisma.activityEvent.deleteMany({
        where: { createdAt: { lt: eventCutoff } },
      }),
      prisma.session.deleteMany({
        where: { expiresAt: { lt: expiredSessionCutoff } },
      }),
      prisma.publicRateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.loginThrottle.deleteMany({
        where: {
          updatedAt: { lt: throttleCutoff },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
      }),
      prisma.eventDedupe.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);

  const assets = await processAssetDeletions();
  const pendingMfa = await prisma.user.updateMany({
    where: { mfaPendingExpires: { lt: now } },
    data: {
      mfaPendingSecret: null,
      mfaPendingSession: null,
      mfaPendingExpires: null,
    },
  });
  return {
    deleted: {
      activityEvents: events.count,
      eventDedupe: dedupe.count,
      assets: assets.removed,
      expiredMfaEnrollments: pendingMfa.count,
      expiredSessions: sessions.count,
      publicRateLimits: publicRateLimits.count,
      loginThrottles: loginThrottles.count,
    },
    policy: {
      analyticsRetentionDays: environment.ANALYTICS_RETENTION_DAYS,
      expiredSessionRetentionDays: environment.EXPIRED_SESSION_RETENTION_DAYS,
    },
  };
}
