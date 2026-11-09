import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import sharp from "sharp";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  publicPathForStoredFile,
  resolveUploadSegments,
} from "@/lib/upload-storage";
import type { AuthenticatedSession } from "@/services/auth.service";
import { getProfileForSession } from "@/services/profile.service";
import {
  assertProfileContext,
  claimProfileVersion,
  type ProfileMutationContext,
} from "@/services/profile-mutation.service";
import {
  processAssetDeletions,
  queueAssetDeletion,
} from "@/services/asset-cleanup.service";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_DIMENSION = 2_000;
const MAX_INPUT_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
const MIME_FORMATS: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadProfilePhoto(
  session: AuthenticatedSession,
  profileId: string,
  file: File,
  context?: ProfileMutationContext,
) {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new AppError(
      422,
      "FILE_SIZE_INVALID",
      "Ukuran foto harus lebih dari 0 dan maksimal 2 MB.",
    );
  }
  const expectedFormat = MIME_FORMATS[file.type];
  if (!expectedFormat) {
    throw new AppError(
      422,
      "FILE_TYPE_INVALID",
      "Gunakan file JPG, PNG, atau WebP.",
    );
  }

  const profile = await getProfileForSession(session, profileId);
  assertProfileContext(profile.companyId, context);
  const input = Buffer.from(await file.arrayBuffer());
  const source = sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
  });
  const metadata = await source.metadata().catch(() => null);
  if (
    !metadata ||
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new AppError(
      422,
      "FILE_CONTENT_INVALID",
      "Isi file tidak sesuai dengan format gambar yang diizinkan.",
    );
  }
  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    throw new AppError(
      422,
      "IMAGE_DIMENSIONS_INVALID",
      "Dimensi foto maksimal 2000 × 2000 piksel.",
    );
  }

  const directory = resolveUploadSegments("profiles", [
    profile.companyId,
    profileId,
  ]);
  if (!directory) {
    throw new AppError(
      500,
      "UPLOAD_PATH_INVALID",
      "Lokasi file upload tidak valid.",
    );
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });

  const token = randomUUID();
  const photoFile = resolveUploadSegments("profiles", [
    profile.companyId,
    profileId,
    `photo-${token}.webp`,
  ]);
  const thumbnailFile = resolveUploadSegments("profiles", [
    profile.companyId,
    profileId,
    `thumb-${token}.webp`,
  ]);
  if (!photoFile || !thumbnailFile) {
    throw new AppError(
      500,
      "UPLOAD_PATH_INVALID",
      "Lokasi file upload tidak valid.",
    );
  }

  try {
    await Promise.all([
      source
        .clone()
        .rotate()
        .resize(600, 600, { fit: "cover", position: "attention" })
        .webp({ quality: 86 })
        .toFile(photoFile),
      source
        .clone()
        .rotate()
        .resize(160, 160, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toFile(thumbnailFile),
    ]);
  } catch {
    await Promise.all([
      rm(photoFile, { force: true }).catch(() => undefined),
      rm(thumbnailFile, { force: true }).catch(() => undefined),
    ]);
    throw new AppError(
      422,
      "IMAGE_PROCESSING_FAILED",
      "Foto tidak dapat diproses.",
    );
  }

  const profilePhoto = publicPathForStoredFile(photoFile, "profiles");
  const profileThumbnail = publicPathForStoredFile(thumbnailFile, "profiles");
  try {
    await prisma.$transaction(async (transaction) => {
      await claimProfileVersion(transaction, profile, context?.expectedVersion);
      await transaction.contactProfile.update({
        where: { id: profileId },
        data: { profilePhoto, profileThumbnail },
      });
      await queueAssetDeletion(transaction, [
        profile.profilePhoto,
        profile.profileThumbnail,
      ]);
      await transaction.auditLog.create({
        data: {
          userId: session.user.id,
          companyId: profile.companyId,
          action: "PROFILE_PHOTO_UPDATED",
          entityType: "ContactProfile",
          entityId: profileId,
          oldValues: { hasPhoto: Boolean(profile.profilePhoto) },
          newValues: { hasPhoto: true },
        },
      });
    });
  } catch (error) {
    await Promise.all([
      rm(photoFile, { force: true }).catch(() => undefined),
      rm(thumbnailFile, { force: true }).catch(() => undefined),
    ]);
    throw error;
  }

  await processAssetDeletions(
    [profile.profilePhoto, profile.profileThumbnail].filter(
      (value): value is string => Boolean(value),
    ),
  ).catch(() => undefined);
  return { profilePhoto, profileThumbnail, version: profile.version + 1 };
}

export async function removeProfilePhoto(
  session: AuthenticatedSession,
  profileId: string,
  context?: ProfileMutationContext,
) {
  const profile = await getProfileForSession(session, profileId);
  assertProfileContext(profile.companyId, context);
  await prisma.$transaction(async (transaction) => {
    await claimProfileVersion(transaction, profile, context?.expectedVersion);
    await transaction.contactProfile.update({
      where: { id: profileId },
      data: { profilePhoto: null, profileThumbnail: null },
    });
    await queueAssetDeletion(transaction, [
      profile.profilePhoto,
      profile.profileThumbnail,
    ]);
    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        companyId: profile.companyId,
        action: "PROFILE_PHOTO_REMOVED",
        entityType: "ContactProfile",
        entityId: profileId,
        oldValues: { hasPhoto: Boolean(profile.profilePhoto) },
        newValues: { hasPhoto: false },
      },
    });
  });
  await processAssetDeletions(
    [profile.profilePhoto, profile.profileThumbnail].filter(
      (value): value is string => Boolean(value),
    ),
  ).catch(() => undefined);
  return { removed: true, version: profile.version + 1 };
}
