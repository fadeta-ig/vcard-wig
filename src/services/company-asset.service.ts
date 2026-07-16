import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedSession } from "@/services/auth.service";

export type CompanyAssetType = "logo" | "favicon";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_INPUT_PIXELS = 20_000_000;
const MIME_FORMATS: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

function localUploadRoot(): string {
  return path.join(process.cwd(), "public", "uploads");
}

function toPublicPath(filePath: string): string {
  const publicRoot = path.resolve(process.cwd(), "public");
  const relative = path.relative(publicRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError(500, "UPLOAD_PATH_INVALID", "Lokasi file upload tidak valid.");
  }
  return `/${relative.split(path.sep).join("/")}`;
}

async function deletePublicAsset(publicPath: string | null): Promise<void> {
  if (!publicPath?.startsWith("/uploads/companies/")) return;
  const publicRoot = path.resolve(process.cwd(), "public");
  const target = path.resolve(publicRoot, publicPath.replace(/^\/+/, ""));
  const allowedRoot = path.resolve(publicRoot, "uploads", "companies");
  if (!target.startsWith(`${allowedRoot}${path.sep}`)) return;
  await rm(target, { force: true }).catch((error: unknown) => {
    console.error("Gagal membersihkan aset lama", error);
  });
}

export async function uploadCompanyAsset(
  session: AuthenticatedSession,
  companyId: string,
  assetType: CompanyAssetType,
  file: File,
) {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new AppError(422, "FILE_SIZE_INVALID", "Ukuran file harus lebih dari 0 dan maksimal 2 MB.");
  }
  const expectedFormat = MIME_FORMATS[file.type];
  if (!expectedFormat) {
    throw new AppError(422, "FILE_TYPE_INVALID", "Gunakan file JPG, PNG, atau WebP.");
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "COMPANY_NOT_FOUND", "Perusahaan tidak ditemukan.");

  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });
  const metadata = await image.metadata().catch(() => null);
  if (!metadata || metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
    throw new AppError(
      422,
      "FILE_CONTENT_INVALID",
      "Isi file tidak sesuai dengan format gambar yang diizinkan.",
    );
  }

  const extension = assetType === "logo" ? "webp" : "png";
  const directory = path.resolve(localUploadRoot(), "companies", companyId);
  const allowedRoot = path.resolve(localUploadRoot(), "companies");
  if (!directory.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new AppError(500, "UPLOAD_PATH_INVALID", "Lokasi file upload tidak valid.");
  }
  await mkdir(directory, { recursive: true });

  const outputPath = path.resolve(directory, `${assetType}-${randomUUID()}.${extension}`);
  if (assetType === "logo") {
    await image
      .rotate()
      .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(outputPath);
  } else {
    await image
      .rotate()
      .resize(256, 256, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      })
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
  }

  const publicPath = toPublicPath(outputPath);
  const oldPath = assetType === "logo" ? company.companyLogo : company.favicon;

  try {
    await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data:
          assetType === "logo"
            ? { companyLogo: publicPath }
            : { favicon: publicPath },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          companyId,
          action: "COMPANY_ASSET_UPDATED",
          entityType: "Company",
          entityId: companyId,
          oldValues: { assetType, path: oldPath },
          newValues: { assetType, path: publicPath },
        },
      }),
    ]);
  } catch (error) {
    await rm(outputPath, { force: true }).catch(() => undefined);
    throw error;
  }

  await deletePublicAsset(oldPath);
  return { assetType, path: publicPath };
}

export async function removeCompanyAsset(
  session: AuthenticatedSession,
  companyId: string,
  assetType: CompanyAssetType,
): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "COMPANY_NOT_FOUND", "Perusahaan tidak ditemukan.");
  const oldPath = assetType === "logo" ? company.companyLogo : company.favicon;

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: assetType === "logo" ? { companyLogo: null } : { favicon: null },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        companyId,
        action: "COMPANY_ASSET_REMOVED",
        entityType: "Company",
        entityId: companyId,
        oldValues: { assetType, path: oldPath },
        newValues: { assetType, path: null },
      },
    }),
  ]);
  await deletePublicAsset(oldPath);
}
