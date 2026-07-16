import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedSession } from "@/services/auth.service";
import { getProfileForSession } from "@/services/profile.service";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_DIMENSION = 2_000;
const MAX_INPUT_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
const MIME_FORMATS: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

function profileUploadRoot(): string {
  return path.resolve(process.cwd(), "public", "uploads", "profiles");
}

function assertWithinRoot(target: string): void {
  const root = profileUploadRoot();
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new AppError(500, "UPLOAD_PATH_INVALID", "Lokasi file upload tidak valid.");
  }
}

function toPublicPath(filePath: string): string {
  const publicRoot = path.resolve(process.cwd(), "public");
  const relative = path.relative(publicRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError(500, "UPLOAD_PATH_INVALID", "Lokasi file upload tidak valid.");
  }
  return `/${relative.split(path.sep).join("/")}`;
}

async function deleteProfileAsset(publicPath: string | null): Promise<void> {
  if (!publicPath?.startsWith("/uploads/profiles/")) return;
  const target = path.resolve(
    process.cwd(),
    "public",
    publicPath.replace(/^\/+/, ""),
  );
  try {
    assertWithinRoot(target);
  } catch {
    return;
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      await rm(target, { force: true });
      return;
    } catch (error) {
      lastError = error;
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (!["EBUSY", "EPERM"].includes(code) || attempt === 7) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  console.error("Gagal membersihkan foto profil lama", lastError);
}

export async function uploadProfilePhoto(
  session: AuthenticatedSession,
  profileId: string,
  file: File,
) {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new AppError(422, "FILE_SIZE_INVALID", "Ukuran foto harus lebih dari 0 dan maksimal 2 MB.");
  }
  const expectedFormat = MIME_FORMATS[file.type];
  if (!expectedFormat) {
    throw new AppError(422, "FILE_TYPE_INVALID", "Gunakan file JPG, PNG, atau WebP.");
  }

  const profile = await getProfileForSession(session, profileId);
  const input = Buffer.from(await file.arrayBuffer());
  const source = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });
  const metadata = await source.metadata().catch(() => null);
  if (!metadata || metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
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

  const directory = path.resolve(profileUploadRoot(), profile.companyId, profileId);
  assertWithinRoot(directory);
  await mkdir(directory, { recursive: true });

  const token = randomUUID();
  const photoFile = path.resolve(directory, `photo-${token}.webp`);
  const thumbnailFile = path.resolve(directory, `thumb-${token}.webp`);
  assertWithinRoot(photoFile);
  assertWithinRoot(thumbnailFile);

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
    throw new AppError(422, "IMAGE_PROCESSING_FAILED", "Foto tidak dapat diproses.");
  }

  const profilePhoto = toPublicPath(photoFile);
  const profileThumbnail = toPublicPath(thumbnailFile);
  try {
    await prisma.$transaction([
      prisma.contactProfile.update({
        where: { id: profileId },
        data: { profilePhoto, profileThumbnail },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          companyId: profile.companyId,
          action: "PROFILE_PHOTO_UPDATED",
          entityType: "ContactProfile",
          entityId: profileId,
          oldValues: { hasPhoto: Boolean(profile.profilePhoto) },
          newValues: { hasPhoto: true },
        },
      }),
    ]);
  } catch (error) {
    await Promise.all([
      rm(photoFile, { force: true }).catch(() => undefined),
      rm(thumbnailFile, { force: true }).catch(() => undefined),
    ]);
    throw error;
  }

  await Promise.all([
    deleteProfileAsset(profile.profilePhoto),
    deleteProfileAsset(profile.profileThumbnail),
  ]);
  return { profilePhoto, profileThumbnail };
}

export async function removeProfilePhoto(
  session: AuthenticatedSession,
  profileId: string,
): Promise<void> {
  const profile = await getProfileForSession(session, profileId);
  await prisma.$transaction([
    prisma.contactProfile.update({
      where: { id: profileId },
      data: { profilePhoto: null, profileThumbnail: null },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        companyId: profile.companyId,
        action: "PROFILE_PHOTO_REMOVED",
        entityType: "ContactProfile",
        entityId: profileId,
        oldValues: { hasPhoto: Boolean(profile.profilePhoto) },
        newValues: { hasPhoto: false },
      },
    }),
  ]);
  await Promise.all([
    deleteProfileAsset(profile.profilePhoto),
    deleteProfileAsset(profile.profileThumbnail),
  ]);
}
