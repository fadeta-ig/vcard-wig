import { ActivityEventType, ProfileStatus } from "@/generated/prisma/client";
import type { PublicEventInput } from "@/lib/analytics-event";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { safeHttpUrl } from "@/lib/public-profile";
import { hashToken } from "@/lib/security/crypto";

type EventMetadata = {
  visitorTokenHash: string;
  userAgent: string | null;
  referrer: string | null;
};

const DEDUPE_WINDOWS_MS: Record<ActivityEventType, number> = {
  PROFILE_VIEW: 30 * 60 * 1_000,
  VCARD_DOWNLOAD: 2_000,
  PHONE_CLICK: 2_000,
  WHATSAPP_CLICK: 2_000,
  EMAIL_CLICK: 2_000,
  SOCIAL_CLICK: 2_000,
  SHARE_CLICK: 2_000,
};

async function persistEvent(
  profileId: string,
  eventType: ActivityEventType,
  metadata: EventMetadata,
): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const now = new Date();
        const keyHash = hashToken(
          `event:${profileId}:${metadata.visitorTokenHash}:${eventType}`,
        );
        await transaction.eventDedupe.upsert({
          where: { keyHash },
          create: { keyHash, expiresAt: new Date(0) },
          update: {},
        });
        const claimed = await transaction.eventDedupe.updateMany({
          where: { keyHash, expiresAt: { lte: now } },
          data: {
            expiresAt: new Date(now.getTime() + DEDUPE_WINDOWS_MS[eventType]),
          },
        });
        if (claimed.count !== 1) return false;
        await transaction.activityEvent.create({
          data: {
            contactProfileId: profileId,
            eventType,
            visitorTokenHash: metadata.visitorTokenHash,
            userAgent: metadata.userAgent,
            referrer: metadata.referrer,
          },
        });
        if (eventType === ActivityEventType.PROFILE_VIEW)
          await transaction.contactProfile.update({
            where: { id: profileId },
            data: { viewCount: { increment: 1 } },
          });
        if (eventType === ActivityEventType.VCARD_DOWNLOAD)
          await transaction.contactProfile.update({
            where: { id: profileId },
            data: { vcardDownloadCount: { increment: 1 } },
          });
        return true;
      });
    } catch (error) {
      const retryable =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ["P2034", "P2002"].includes((error as { code?: string }).code ?? "");
      if (!retryable || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
    }
  }
  return true;
}

export async function recordClientEvent(
  slug: string,
  input: PublicEventInput,
  metadata: EventMetadata,
): Promise<boolean> {
  const profile = await prisma.contactProfile.findFirst({
    where: {
      slug,
      status: ProfileStatus.ACTIVE,
      company: { is: { isActive: true } },
    },
    select: {
      id: true,
      showEmail: true,
      showPhone: true,
      showWorkPhone: true,
      showMobilePhone: true,
      showWhatsapp: true,
      showSocialLinks: true,
      email: true,
      workPhone: true,
      mobilePhone: true,
      whatsappNumber: true,
      socialLinks: {
        where: { isActive: true },
        select: { id: true, url: true, isActive: true },
        take: 20,
      },
    },
  });
  if (!profile)
    throw new AppError(404, "PROFILE_NOT_FOUND", "Profil tidak ditemukan.");

  const validTarget = (() => {
    switch (input.eventType) {
      case "PHONE_CLICK":
        return (
          profile.showPhone &&
          Boolean(
            (profile.showMobilePhone && profile.mobilePhone) ||
            (profile.showWorkPhone && profile.workPhone),
          )
        );
      case "WHATSAPP_CLICK":
        return (
          profile.showPhone &&
          profile.showWhatsapp &&
          Boolean(profile.whatsappNumber)
        );
      case "EMAIL_CLICK":
        return profile.showEmail && Boolean(profile.email);
      case "SOCIAL_CLICK": {
        const target = profile.socialLinks.find(
          (link) => hashToken(link.id) === input.targetId,
        );
        return (
          profile.showSocialLinks &&
          Boolean(target?.isActive && safeHttpUrl(target.url))
        );
      }
      default:
        return true;
    }
  })();
  if (!validTarget) {
    throw new AppError(
      422,
      "EVENT_TARGET_INVALID",
      "Target aktivitas tidak tersedia.",
    );
  }

  return persistEvent(profile.id, ActivityEventType[input.eventType], metadata);
}

export async function recordVCardDownload(
  profileId: string,
  metadata: EventMetadata,
): Promise<boolean> {
  return persistEvent(profileId, ActivityEventType.VCARD_DOWNLOAD, metadata);
}
