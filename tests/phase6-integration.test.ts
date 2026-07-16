import { beforeEach, describe, expect, it } from "vitest";
import { ActivityEventType, ProfileStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/security/crypto";
import { assertPublicRateLimit } from "@/lib/security/public-request";
import {
  getAnalyticsReport,
  getDashboardData,
  resolveAnalyticsScope,
} from "@/services/analytics.service";
import { recordClientEvent } from "@/services/analytics-event.service";
import { listAuditLogs, parseAuditFilters } from "@/services/audit.service";
import { authenticateUser } from "@/services/auth.service";
import { runRetentionCleanup } from "@/services/maintenance.service";
import { hashPassword } from "@/lib/security/password";

async function cleanDatabase() {
  await prisma.publicRateLimit.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.socialLink.deleteMany();
  await prisma.contactProfile.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loginThrottle.deleteMany();
  await prisma.userCompanyMembership.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
}

async function fixture() {
  const user = await prisma.user.create({
    data: {
      username: "phase6-root",
      name: "Phase 6 Root",
      passwordHash: await hashPassword("temporary-password-123"),
      role: UserRole.SUPER_ADMIN,
    },
  });
  const companyA = await prisma.company.create({
    data: { name: "Analytics Company A", slug: "analytics-company-a" },
  });
  const companyB = await prisma.company.create({
    data: { name: "Analytics Company B", slug: "analytics-company-b" },
  });
  const profileA = await prisma.contactProfile.create({
    data: {
      companyId: companyA.id,
      createdById: user.id,
      slug: "analytics-profile-a",
      firstName: "Analytics",
      displayName: "Analytics Profile A",
      jobTitle: "Director",
      companyName: companyA.name,
      email: "analytics-a@example.com",
      mobilePhone: "+6281234567801",
      whatsappNumber: "+6281234567801",
      status: ProfileStatus.ACTIVE,
      socialLinks: {
        create: {
          platform: "LINKEDIN",
          label: "LinkedIn",
          url: "https://www.linkedin.com/in/analytics-a",
          isActive: true,
        },
      },
    },
    include: { socialLinks: true },
  });
  const profileB = await prisma.contactProfile.create({
    data: {
      companyId: companyB.id,
      createdById: user.id,
      slug: "analytics-profile-b",
      firstName: "Analytics",
      displayName: "Analytics Profile B",
      jobTitle: "Manager",
      companyName: companyB.name,
      email: "analytics-b@example.com",
      status: ProfileStatus.ACTIVE,
    },
  });
  return { user, companyA, companyB, profileA, profileB };
}

function metadata(token: string) {
  return {
    visitorTokenHash: hashToken(token),
    userAgent: "Phase 6 Test Browser",
    referrer: "https://example.com/directory",
  };
}

describe.sequential("phase 6 analytics, audit, and retention integration", () => {
  beforeEach(cleanDatabase);

  it("validates action targets, deduplicates views, and updates counters atomically", async () => {
    const { profileA } = await fixture();
    await expect(
      recordClientEvent(profileA.slug, { eventType: "SOCIAL_CLICK", targetId: "missing-target" }, metadata("visitor-a")),
    ).rejects.toMatchObject({ code: "EVENT_TARGET_INVALID" });

    await expect(recordClientEvent(profileA.slug, { eventType: "PROFILE_VIEW" }, metadata("visitor-a"))).resolves.toBe(true);
    await expect(recordClientEvent(profileA.slug, { eventType: "PROFILE_VIEW" }, metadata("visitor-a"))).resolves.toBe(false);
    const stored = await prisma.contactProfile.findUniqueOrThrow({ where: { id: profileA.id } });
    expect(stored.viewCount).toBe(1);
    expect(await prisma.activityEvent.count({ where: { contactProfileId: profileA.id } })).toBe(1);
  });

  it("does not lose increments when independent visitors arrive concurrently", async () => {
    const { profileA } = await fixture();
    const visitors = Array.from({ length: 12 }, (_, index) => `concurrent-${index}`);
    await Promise.all(
      visitors.map((visitor) =>
        recordClientEvent(profileA.slug, { eventType: "PROFILE_VIEW" }, metadata(visitor)),
      ),
    );
    const stored = await prisma.contactProfile.findUniqueOrThrow({ where: { id: profileA.id } });
    expect(stored.viewCount).toBe(visitors.length);
    expect(await prisma.activityEvent.count({ where: { contactProfileId: profileA.id } })).toBe(visitors.length);
  });

  it("keeps dashboard and analytics report data isolated by company", async () => {
    const { user, companyA, companyB, profileA, profileB } = await fixture();
    await prisma.activityEvent.createMany({
      data: [
        { contactProfileId: profileA.id, eventType: ActivityEventType.PROFILE_VIEW, visitorTokenHash: hashToken("a-1") },
        { contactProfileId: profileA.id, eventType: ActivityEventType.EMAIL_CLICK, visitorTokenHash: hashToken("a-2") },
        { contactProfileId: profileB.id, eventType: ActivityEventType.PROFILE_VIEW, visitorTokenHash: hashToken("b-1") },
      ],
    });
    const session = (await authenticateUser("phase6-root", "temporary-password-123")).session;
    const scopeA = resolveAnalyticsScope(session, { id: companyA.id, name: companyA.name }, undefined);
    const dashboardA = await getDashboardData(scopeA);
    expect(dashboardA.eventsThirtyDays).toBe(2);
    expect(dashboardA.topProfiles.map((profile) => profile.id)).toEqual([profileA.id]);

    const now = new Date();
    const reportA = await getAnalyticsReport(scopeA, {
      from: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      toExclusive: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
      fromInput: "2026-07-14",
      toInput: "2026-07-16",
      page: 1,
    });
    expect(reportA.totalEvents).toBe(2);
    expect(reportA.rows.map((row) => row.profileId)).toEqual([profileA.id]);

    const globalScope = resolveAnalyticsScope(session, { id: companyB.id, name: companyB.name }, "global");
    expect((await getDashboardData(globalScope)).eventsThirtyDays).toBe(3);
    expect(user.role).toBe(UserRole.SUPER_ADMIN);
  });

  it("redacts sensitive audit keys and denies audit access to a regular admin", async () => {
    const { user, companyA } = await fixture();
    const session = (await authenticateUser("phase6-root", "temporary-password-123")).session;
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: companyA.id,
        action: "SENSITIVE_TEST",
        entityType: "SecurityFixture",
        entityId: "fixture-1",
        oldValues: { name: "Before", password: "do-not-display", nested: { csrfToken: "secret" } },
        newValues: { name: "After", apiToken: "do-not-display" },
      },
    });
    const result = await listAuditLogs(session, parseAuditFilters({ action: "SENSITIVE_TEST" }));
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].oldValues).toContain("[REDACTED]");
    expect(result.logs[0].newValues).toContain("[REDACTED]");
    expect(`${result.logs[0].oldValues}${result.logs[0].newValues}`).not.toContain("do-not-display");

    await expect(
      listAuditLogs({ ...session, user: { ...session.user, role: UserRole.ADMIN } }, parseAuditFilters({})),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("enforces a centralized visitor rate limit without an IP key", async () => {
    await fixture();
    const identity = { tokenHash: hashToken("rate-limited-visitor") };
    const keyHash = hashToken(`public-rate-limit:vcard:visitor:${identity.tokenHash}`);
    await prisma.publicRateLimit.create({
      data: {
        keyHash,
        windowStartedAt: new Date(),
        requestCount: 20,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(assertPublicRateLimit("vcard", "analytics-profile-a", identity)).rejects.toMatchObject({
      code: "PUBLIC_RATE_LIMITED",
      status: 429,
    });
  });

  it("removes expired operational data according to the retention policy", async () => {
    const { user, profileA } = await fixture();
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1_000);
    await prisma.activityEvent.create({
      data: { contactProfileId: profileA.id, eventType: ActivityEventType.PROFILE_VIEW, createdAt: oldDate },
    });
    await prisma.session.create({
      data: {
        tokenHash: "a".repeat(64),
        csrfTokenHash: "b".repeat(64),
        userId: user.id,
        expiresAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1_000),
      },
    });
    await prisma.publicRateLimit.create({
      data: {
        keyHash: "c".repeat(64),
        windowStartedAt: oldDate,
        expiresAt: oldDate,
      },
    });
    const result = await runRetentionCleanup();
    expect(result.deleted.activityEvents).toBe(1);
    expect(result.deleted.expiredSessions).toBe(1);
    expect(result.deleted.publicRateLimits).toBe(1);
  });
});

