import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/security/crypto";
import { hashPassword } from "@/lib/security/password";
import { profileCreateSchema, profileUpdateSchema } from "@/lib/validation";
import {
  createProfile,
  getProfileForSession,
  updateProfile,
  changeProfileStatus,
  permanentlyDeleteProfile,
} from "@/services/profile.service";
import { assertEditorCompany } from "@/services/profile-mutation.service";
import { uploadProfilePhoto } from "@/services/profile-photo.service";
import { recordClientEvent } from "@/services/analytics-event.service";
import {
  getDashboardData,
  getAnalyticsReport,
  parseAnalyticsFilters,
} from "@/services/analytics.service";
import { getPublicProfileBySlug } from "@/services/public-profile.service";
import { resolvePublicUploadPath } from "@/lib/upload-storage";
import { GET as photoGet } from "@/app/uploads/[...path]/route";
import { DELETE as permanentDelete } from "@/app/api/admin/profiles/[id]/permanent/route";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  verifyUserMfa,
} from "@/services/mfa.service";
import { totpAt } from "@/lib/security/totp";
import { getEnvironment, resetEnvironmentForTests } from "@/lib/env";
import {
  authenticateUser,
  type AuthenticatedSession,
} from "@/services/auth.service";

const selected = vi.hoisted(() => ({ id: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "vcard_company" ? { value: selected.id } : undefined,
  }),
}));

if (
  process.env.DATABASE_NAME !== "vcard_wig_test" ||
  process.env.DATABASE_HOST !== "127.0.0.1"
)
  throw new Error(
    "Refusing integration tests outside isolated loopback test database.",
  );
const run = `remediation-${randomUUID().slice(0, 8)}`;
let session: AuthenticatedSession;
let companyId: string;
let otherCompanyId: string;
let regular: AuthenticatedSession;
const slugs: string[] = [];
const eventKeys: string[] = [];
const sessionToken = randomUUID();
const csrfToken = randomUUID();
function context(version: number) {
  return { expectedCompanyId: companyId, expectedVersion: version };
}
async function fixture() {
  const slug = `${run}-${slugs.length}`;
  slugs.push(slug);
  return createProfile(
    session,
    companyId,
    profileCreateSchema.parse({
      slug,
      firstName: "Audit",
      jobTitle: "Director",
      companyName: "Audit Company",
      email: "audit@example.invalid",
      mobilePhone: "+628123456789",
      socialLinks: [
        {
          platform: "LINKEDIN",
          url: "https://www.linkedin.com/company/example",
          isActive: true,
        },
      ],
    }),
  );
}
beforeAll(async () => {
  const root = await prisma.user.create({
    data: {
      username: `${run}-root`,
      name: "Audit Root",
      role: "SUPER_ADMIN",
      passwordHash: await hashPassword("audit-test-password-2026"),
    },
  });
  const admin = await prisma.user.create({
    data: {
      username: `${run}-admin`,
      name: "Audit Admin",
      passwordHash: "not-used",
    },
  });
  const company = await prisma.company.create({
    data: { slug: run, name: "Audit Company" },
  });
  companyId = company.id;
  selected.id = companyId;
  otherCompanyId = (
    await prisma.company.create({
      data: { slug: `${run}-other`, name: "Other Company" },
    })
  ).id;
  await prisma.userCompanyMembership.create({
    data: { userId: admin.id, companyId: otherCompanyId },
  });
  const stored = await prisma.session.create({
    data: {
      userId: root.id,
      tokenHash: hashToken(sessionToken),
      csrfTokenHash: hashToken(csrfToken),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  session = {
    id: stored.id,
    csrfTokenHash: stored.csrfTokenHash,
    expiresAt: stored.expiresAt,
    lastSeenAt: stored.lastSeenAt,
    user: root,
  };
  regular = { ...session, id: "unused-regular-session", user: admin };
});
afterAll(async () => {
  vi.useRealTimers();
  const profiles = await prisma.contactProfile.findMany({
    where: { companyId: { in: [companyId, otherCompanyId] } },
    select: { id: true, profilePhoto: true, profileThumbnail: true },
  });
  const { queueAssetDeletion, processAssetDeletions } =
    await import("@/services/asset-cleanup.service");
  await prisma.$transaction((tx) =>
    queueAssetDeletion(
      tx,
      profiles.flatMap((profile) => [
        profile.profilePhoto,
        profile.profileThumbnail,
      ]),
    ),
  );
  await prisma.contactProfile.deleteMany({
    where: { companyId: { in: [companyId, otherCompanyId] } },
  });
  await processAssetDeletions();
  await prisma.eventDedupe.deleteMany({
    where: { keyHash: { in: eventKeys } },
  });
  await prisma.profileSlugReservation.deleteMany({
    where: {
      slugHash: { in: slugs.map((slug) => hashToken(`profile-slug:${slug}`)) },
    },
  });
  await prisma.auditLog.deleteMany({
    where: { userId: { in: [session.user.id, regular.user.id] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [session.user.id, regular.user.id] } },
  });
  await prisma.mfaRecoveryCode.deleteMany({
    where: { userId: { in: [session.user.id, regular.user.id] } },
  });
  await prisma.userCompanyMembership.deleteMany({
    where: { userId: regular.user.id },
  });
  await prisma.company.deleteMany({
    where: { id: { in: [companyId, otherCompanyId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [session.user.id, regular.user.id] } },
  });
  await prisma.loginThrottle.deleteMany({
    where: {
      identifierHash: {
        in: [hashToken(session.user.username), hashToken(`${run}-missing`)],
      },
    },
  });
  await prisma.publicRateLimit.deleteMany({
    where: {
      keyHash: hashToken(`public-rate-limit:mfa:settings:${session.user.id}`),
    },
  });
  await prisma.$disconnect();
});

describe.sequential("focused audit remediation integration", () => {
  it("rejects a switched company before mutating an old editor", async () => {
    selected.id = otherCompanyId;
    await expect(assertEditorCompany(session, companyId)).rejects.toMatchObject(
      { code: "COMPANY_CONTEXT_CHANGED" },
    );
    selected.id = companyId;
  });
  it("rejects stale edits and stale status transitions atomically", async () => {
    const profile = await fixture();
    await updateProfile(
      session,
      profile.id,
      profileUpdateSchema.parse({ jobTitle: "Editor A" }),
      context(profile.version),
    );
    await expect(
      updateProfile(
        session,
        profile.id,
        profileUpdateSchema.parse({ jobTitle: "Old editor" }),
        context(profile.version),
      ),
    ).rejects.toMatchObject({ code: "PROFILE_VERSION_CONFLICT" });
    await expect(
      changeProfileStatus(
        session,
        profile.id,
        "ACTIVE",
        context(profile.version),
      ),
    ).rejects.toMatchObject({ code: "PROFILE_VERSION_CONFLICT" });
    expect((await getProfileForSession(session, profile.id)).jobTitle).toBe(
      "Editor A",
    );
  });
  it("keeps first-publication URL locked after archive and restore", async () => {
    const profile = await fixture();
    await changeProfileStatus(session, profile.id, "ACTIVE");
    await changeProfileStatus(session, profile.id, "ARCHIVED");
    const restored = await changeProfileStatus(session, profile.id, "DRAFT");
    expect(restored.publishedAt).toBeNull();
    expect(restored.firstPublishedAt).not.toBeNull();
    await expect(
      updateProfile(
        session,
        profile.id,
        profileUpdateSchema.parse({ slug: `${run}-renamed` }),
        context(restored.version),
      ),
    ).rejects.toMatchObject({ code: "PROFILE_SLUG_LOCKED" });
  });
  it("only deletes archived profiles, with exact confirmation and company authorization", async () => {
    const profile = await fixture();
    await expect(
      permanentlyDeleteProfile(
        session,
        profile.id,
        profile.slug,
        context(profile.version),
      ),
    ).rejects.toMatchObject({ code: "PROFILE_MUST_BE_ARCHIVED" });
    const archived = await changeProfileStatus(session, profile.id, "ARCHIVED");
    await expect(
      permanentlyDeleteProfile(
        regular,
        profile.id,
        profile.slug,
        context(archived.version),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      permanentlyDeleteProfile(
        session,
        profile.id,
        "incorrect",
        context(archived.version),
      ),
    ).rejects.toMatchObject({ code: "DELETE_CONFIRMATION_REQUIRED" });
    await expect(
      permanentlyDeleteProfile(session, profile.id, profile.slug, {
        expectedCompanyId: otherCompanyId,
        expectedVersion: archived.version,
      }),
    ).rejects.toMatchObject({ code: "COMPANY_CONTEXT_CHANGED" });
    await changeProfileStatus(session, profile.id, "DRAFT");
    await expect(
      permanentlyDeleteProfile(
        session,
        profile.id,
        profile.slug,
        context(archived.version),
      ),
    ).rejects.toMatchObject({ code: "PROFILE_MUST_BE_ARCHIVED" });
  });
  it("revokes anonymous photo access when visibility or status changes", async () => {
    const profile = await fixture();
    const image = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#667085" },
    })
      .png()
      .toBuffer();
    const uploaded = await uploadProfilePhoto(
      session,
      profile.id,
      new File([new Uint8Array(image)], "audit.png", { type: "image/png" }),
      context(profile.version),
    );
    const path = uploaded.profilePhoto.split("/").slice(2);
    const request = () =>
      photoGet(new Request(`http://localhost:3000${uploaded.profilePhoto}`), {
        params: Promise.resolve({ path }),
      });
    expect((await request()).status).toBe(404);
    const active = await changeProfileStatus(session, profile.id, "ACTIVE");
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await updateProfile(
      session,
      profile.id,
      profileUpdateSchema.parse({ showPhoto: false }),
      context(active.version),
    );
    expect((await request()).status).toBe(404);
    const latest = await getProfileForSession(session, profile.id);
    await updateProfile(
      session,
      profile.id,
      profileUpdateSchema.parse({ showPhoto: true }),
      context(latest.version),
    );
    await changeProfileStatus(session, profile.id, "INACTIVE");
    expect((await request()).status).toBe(404);
  });
  it("permanently removes dependent data and photos while reserving the old URL", async () => {
    const profile = await fixture();
    const image = await sharp({
      create: { width: 12, height: 12, channels: 3, background: "#112233" },
    })
      .png()
      .toBuffer();
    const uploaded = await uploadProfilePhoto(
      session,
      profile.id,
      new File([new Uint8Array(image)], "audit.png", { type: "image/png" }),
    );
    await prisma.activityEvent.create({
      data: { contactProfileId: profile.id, eventType: "PROFILE_VIEW" },
    });
    const archived = await changeProfileStatus(session, profile.id, "ARCHIVED");
    const result = await permanentlyDeleteProfile(
      session,
      profile.id,
      profile.slug,
      context(archived.version),
    );
    expect(result.deleted).toBe(true);
    expect(result.assetCleanupPending).toBe(false);
    expect(
      await prisma.contactProfile.count({ where: { id: profile.id } }),
    ).toBe(0);
    expect(
      await prisma.socialLink.count({
        where: { contactProfileId: profile.id },
      }),
    ).toBe(0);
    expect(
      await prisma.activityEvent.count({
        where: { contactProfileId: profile.id },
      }),
    ).toBe(0);
    await expect(
      access(resolvePublicUploadPath(uploaded.profilePhoto)!),
    ).rejects.toBeDefined();
    expect(await getPublicProfileBySlug(profile.slug)).toEqual({
      kind: "not_found",
    });
    await expect(
      createProfile(
        session,
        companyId,
        profileCreateSchema.parse({
          slug: profile.slug,
          firstName: "Someone else",
          jobTitle: "New",
          companyName: "Company",
          email: "new@example.invalid",
        }),
      ),
    ).rejects.toMatchObject({ code: "PROFILE_SLUG_CONFLICT" });
    const logs = await prisma.auditLog.findMany({
      where: { entityId: profile.id },
    });
    expect(
      logs.some((log) => log.action === "PROFILE_PERMANENTLY_DELETED"),
    ).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("audit@example.invalid");
    expect(JSON.stringify(logs)).not.toContain('"displayName":"Audit"');
  });
  it("requires authentication, CSRF and a version on the permanent-delete endpoint", async () => {
    const profile = await fixture();
    const archived = await changeProfileStatus(session, profile.id, "ARCHIVED");
    const params = { params: Promise.resolve({ id: profile.id }) };
    const url = `http://localhost:3000/api/admin/profiles/${profile.id}/permanent`;
    expect(
      (
        await permanentDelete(
          new NextRequest(url, {
            method: "DELETE",
            body: JSON.stringify({ confirmation: profile.slug }),
          }),
          params,
        )
      ).status,
    ).toBe(401);
    const headers = {
      cookie: `vcard_session=${sessionToken}`,
      origin: "http://localhost:3000",
      "x-vcard-request": "1",
    };
    expect(
      (
        await permanentDelete(
          new NextRequest(url, { method: "DELETE", headers, body: "{}" }),
          params,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await permanentDelete(
          new NextRequest(url, {
            method: "DELETE",
            headers: { ...headers, "x-csrf-token": csrfToken },
            body: "{}",
          }),
          params,
        )
      ).status,
    ).toBe(428);
    expect(
      await prisma.contactProfile.count({ where: { id: archived.id } }),
    ).toBe(1);
  });
  it("deduplicates concurrent events from the same visitor in the database", async () => {
    const profile = await fixture();
    await changeProfileStatus(session, profile.id, "ACTIVE");
    const token = hashToken(`${run}:visitor`);
    eventKeys.push(hashToken(`event:${profile.id}:${token}:PROFILE_VIEW`));
    const accepted = await Promise.all(
      Array.from({ length: 6 }, () =>
        recordClientEvent(
          profile.slug,
          { eventType: "PROFILE_VIEW" },
          { visitorTokenHash: token, userAgent: null, referrer: null },
        ),
      ),
    );
    expect(accepted.filter(Boolean)).toHaveLength(1);
    expect(
      await prisma.activityEvent.count({
        where: { contactProfileId: profile.id },
      }),
    ).toBe(1);
    expect((await getProfileForSession(session, profile.id)).viewCount).toBe(1);
  });
  it("groups the dashboard by Jakarta day and paginates report rows in SQL", async () => {
    const profile = await fixture();
    await prisma.activityEvent.createMany({
      data: [
        {
          contactProfileId: profile.id,
          eventType: "EMAIL_CLICK",
          createdAt: new Date("2026-11-08T18:00:00Z"),
        },
        {
          contactProfileId: profile.id,
          eventType: "EMAIL_CLICK",
          createdAt: new Date("2026-11-09T00:15:00Z"),
        },
      ],
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T01:00:00Z"));
    try {
      const scope = { kind: "company" as const, companyId, label: "Test" };
      const dashboard = await getDashboardData(scope);
      expect(
        dashboard.dailyEvents.find((row) => row.day === "2026-11-09")!.total,
      ).toBeGreaterThanOrEqual(2);
      const report = await getAnalyticsReport(
        scope,
        parseAnalyticsFilters({
          from: "2026-11-09",
          to: "2026-11-09",
          profileId: profile.id,
        }),
      );
      expect(report.rows).toHaveLength(1);
      expect(report.rows[0].counts.EMAIL_CLICK).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("enrolls encrypted MFA with replay-safe codes and single-use recovery", async () => {
    const oldKey = process.env.MFA_ENCRYPTION_KEY;
    process.env.MFA_ENCRYPTION_KEY = "a".repeat(64);
    resetEnvironmentForTests();
    try {
      const setup = await beginMfaEnrollment(
        session,
        "audit-test-password-2026",
      );
      const result = await confirmMfaEnrollment(session, totpAt(setup.secret));
      expect(result.recoveryCodes).toHaveLength(10);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: session.user.id },
      });
      expect(user.mfaSecretEncrypted).not.toContain(setup.secret);
      expect(
        await verifyUserMfa(
          user.id,
          user.mfaSecretEncrypted!,
          totpAt(setup.secret),
        ),
      ).toBe(false);
      await expect(
        authenticateUser(user.username, "audit-test-password-2026"),
      ).rejects.toMatchObject({ code: "MFA_REQUIRED" });
      const authenticated = await authenticateUser(
        user.username,
        "audit-test-password-2026",
        result.recoveryCodes[1],
      );
      expect(authenticated.session.user.username).toBe(user.username);
      expect(JSON.stringify(authenticated.session.user)).not.toContain(
        setup.secret,
      );
      await expect(
        authenticateUser(
          user.username,
          "audit-test-password-2026",
          result.recoveryCodes[1],
        ),
      ).rejects.toMatchObject({ code: "MFA_INVALID" });
      expect(
        await verifyUserMfa(
          user.id,
          user.mfaSecretEncrypted!,
          result.recoveryCodes[0],
        ),
      ).toBe(true);
      expect(
        await verifyUserMfa(
          user.id,
          user.mfaSecretEncrypted!,
          result.recoveryCodes[0],
        ),
      ).toBe(false);
    } finally {
      if (oldKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
      else process.env.MFA_ENCRYPTION_KEY = oldKey;
      resetEnvironmentForTests();
      getEnvironment();
    }
  });
});
