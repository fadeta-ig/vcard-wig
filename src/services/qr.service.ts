import { createHash } from "node:crypto";
import QRCode from "qrcode";
import sharp from "sharp";
import type { z } from "zod";
import { AppError } from "@/lib/api";
import { getEnvironment } from "@/lib/env";
import { publicProfileUrl, safePublicAsset } from "@/lib/public-profile";
import { resolvePublicUploadPath } from "@/lib/upload-storage";
import { qrExportQuerySchema } from "@/lib/validation";
import type { AuthenticatedSession } from "@/services/auth.service";
import { getProfileForSession } from "@/services/profile.service";
import { getDirectVCard } from "@/services/vcard.service";

export type QrExportOptions = z.infer<typeof qrExportQuerySchema>;

export type GeneratedQr = {
  body: Buffer | string;
  contentType: "image/png" | "image/svg+xml";
  fileName: string;
  fingerprint: string;
  payload: string;
  options: QrExportOptions;
  cacheHit: boolean;
};

type CachedQr = Omit<GeneratedQr, "cacheHit">;
const qrCache = new Map<string, CachedQr>();
const MAX_CACHE_ITEMS = 100;

function cacheRead(fingerprint: string): CachedQr | undefined {
  const cached = qrCache.get(fingerprint);
  if (!cached) return undefined;
  qrCache.delete(fingerprint);
  qrCache.set(fingerprint, cached);
  return cached;
}

function cacheWrite(fingerprint: string, value: CachedQr) {
  qrCache.set(fingerprint, value);
  while (qrCache.size > MAX_CACHE_ITEMS) {
    const oldest = qrCache.keys().next().value as string | undefined;
    if (!oldest) break;
    qrCache.delete(oldest);
  }
}

export function clearQrCacheForTests() {
  qrCache.clear();
}

export function qrCacheSizeForTests(): number {
  return qrCache.size;
}

function publicFilePath(publicPath: string, category: "companies"): string | undefined {
  const safePath = safePublicAsset(publicPath, category);
  return safePath ? resolvePublicUploadPath(safePath, category) : undefined;
}

async function logoPng(publicPath: string, maximumSize: number): Promise<Buffer> {
  const filePath = publicFilePath(publicPath, "companies");
  if (!filePath) {
    throw new AppError(422, "QR_LOGO_UNAVAILABLE", "Logo perusahaan tidak tersedia untuk QR.");
  }
  try {
    return await sharp(filePath)
      .resize(maximumSize, maximumSize, { fit: "contain", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    throw new AppError(422, "QR_LOGO_UNAVAILABLE", "Logo perusahaan tidak dapat diproses untuk QR.");
  }
}

async function renderPng(
  payload: string,
  options: QrExportOptions,
  logoPath?: string,
): Promise<Buffer> {
  const base = await QRCode.toBuffer(payload, {
    type: "png",
    width: options.size,
    margin: options.margin,
    errorCorrectionLevel: options.errorCorrection,
    color: { dark: options.foreground, light: options.background },
  });
  if (!logoPath) return base;

  const logoSize = Math.max(36, Math.round(options.size * 0.17));
  const padding = Math.max(5, Math.round(options.size * 0.018));
  const boxSize = logoSize + padding * 2;
  const left = Math.round((options.size - boxSize) / 2);
  const top = Math.round((options.size - boxSize) / 2);
  const background = await sharp({
    create: {
      width: boxSize,
      height: boxSize,
      channels: 4,
      background: options.background,
    },
  }).png().toBuffer();
  const logo = await logoPng(logoPath, logoSize);
  const logoMetadata = await sharp(logo).metadata();
  const logoWidth = logoMetadata.width ?? logoSize;
  const logoHeight = logoMetadata.height ?? logoSize;
  return sharp(base)
    .composite([
      { input: background, left, top },
      {
        input: logo,
        left: Math.round((options.size - logoWidth) / 2),
        top: Math.round((options.size - logoHeight) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function assertSafeGeneratedSvg(svg: string): void {
  if (!svg.startsWith("<svg") || /<script|<foreignObject|javascript:|\son\w+\s*=/i.test(svg)) {
    throw new AppError(500, "QR_SVG_INVALID", "SVG QR gagal divalidasi.");
  }
}

async function renderSvg(
  payload: string,
  options: QrExportOptions,
  logoPath?: string,
): Promise<string> {
  let svg = await QRCode.toString(payload, {
    type: "svg",
    width: options.size,
    margin: options.margin,
    errorCorrectionLevel: options.errorCorrection,
    color: { dark: options.foreground, light: options.background },
  });
  assertSafeGeneratedSvg(svg);
  if (!logoPath) return svg;

  const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!viewBox) throw new AppError(500, "QR_SVG_INVALID", "Ukuran SVG QR tidak valid.");
  const width = Number(viewBox[1]);
  const height = Number(viewBox[2]);
  const logoWidth = width * 0.17;
  const logoHeight = height * 0.17;
  const padding = width * 0.018;
  const boxWidth = logoWidth + padding * 2;
  const boxHeight = logoHeight + padding * 2;
  const logo = await logoPng(logoPath, 256);
  const dataUrl = `data:image/png;base64,${logo.toString("base64")}`;
  const overlay = `<rect x="${(width - boxWidth) / 2}" y="${(height - boxHeight) / 2}" width="${boxWidth}" height="${boxHeight}" fill="${options.background}"/><image href="${dataUrl}" x="${(width - logoWidth) / 2}" y="${(height - logoHeight) / 2}" width="${logoWidth}" height="${logoHeight}" preserveAspectRatio="xMidYMid meet"/>`;
  svg = svg.replace("</svg>", `${overlay}</svg>`);
  assertSafeGeneratedSvg(svg);
  return svg;
}

function fingerprintFor(payload: string, options: QrExportOptions, logoPath?: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ payload, options, logoPath: logoPath ?? null }))
    .digest("hex");
}

function rawOptions(
  query: Record<string, string | undefined>,
  defaults: { foreground: string; background: string; logo: boolean },
) {
  return {
    type: query.type,
    format: query.format,
    size: query.size,
    margin: query.margin,
    errorCorrection: query.errorCorrection,
    foreground: query.foreground ?? defaults.foreground,
    background: query.background ?? defaults.background,
    logo: query.logo ?? String(defaults.logo),
  };
}

export async function generateProfileQr(
  session: AuthenticatedSession,
  profileId: string,
  query: Record<string, string | undefined>,
): Promise<GeneratedQr> {
  const profile = await getProfileForSession(session, profileId);
  const requestedLogo = query.logo === undefined
    ? profile.company.qrLogoEnabled && Boolean(profile.company.companyLogo)
    : query.logo === "true";
  const options = qrExportQuerySchema.parse(
    rawOptions(query, {
      foreground: profile.company.defaultQrForeground,
      background: profile.company.defaultQrBackground,
      logo: requestedLogo,
    }),
  );
  const logoPath = options.logo
    ? safePublicAsset(profile.company.companyLogo, "companies")
    : undefined;
  if (options.logo && !logoPath) {
    throw new AppError(422, "QR_LOGO_UNAVAILABLE", "Unggah logo perusahaan sebelum mengaktifkan logo QR.");
  }

  const payload = options.type === "dynamic"
    ? publicProfileUrl(getEnvironment().APP_URL, profile.slug)
    : (await getDirectVCard(session, profileId)).content;
  const fingerprint = fingerprintFor(payload, options, logoPath);
  const cached = cacheRead(fingerprint);
  if (cached) return { ...cached, cacheHit: true };

  try {
    const body = options.format === "png"
      ? await renderPng(payload, options, logoPath)
      : await renderSvg(payload, options, logoPath);
    const value: CachedQr = {
      body,
      contentType: options.format === "png" ? "image/png" : "image/svg+xml",
      fileName: options.type === "dynamic"
        ? `qr-${profile.slug}.${options.format}`
        : `qr-vcard-${profile.slug}.${options.format}`,
      fingerprint,
      payload,
      options,
    };
    cacheWrite(fingerprint, value);
    return { ...value, cacheHit: false };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Pembuatan QR gagal.");
    throw new AppError(
      422,
      "QR_PAYLOAD_TOO_LARGE",
      "Data terlalu panjang untuk opsi QR ini. Gunakan QR dinamis atau kurangi data kontak.",
    );
  }
}
