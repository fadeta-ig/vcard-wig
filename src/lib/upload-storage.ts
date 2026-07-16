import path from "node:path";
import { AppError } from "@/lib/api";
import { getEnvironment } from "@/lib/env";

export type UploadCategory = "companies" | "profiles";

const UPLOAD_CATEGORIES = new Set<UploadCategory>(["companies", "profiles"]);
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,190}$/;

export function isUploadCategory(value: string): value is UploadCategory {
  return UPLOAD_CATEGORIES.has(value as UploadCategory);
}

export function uploadRoot(): string {
  const configuredRoot = getEnvironment().UPLOAD_DIR;
  return configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(process.cwd(), "public", "uploads");
}

export function uploadCategoryRoot(category: UploadCategory): string {
  return path.resolve(uploadRoot(), category);
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function safeSegments(segments: string[]): boolean {
  return segments.length > 0 && segments.every((segment) => SAFE_SEGMENT.test(segment));
}

export function resolveUploadSegments(
  category: UploadCategory,
  segments: string[],
): string | undefined {
  if (!safeSegments(segments)) return undefined;
  const root = uploadCategoryRoot(category);
  const target = path.resolve(root, ...segments);
  return isWithin(root, target) ? target : undefined;
}

export function resolvePublicUploadPath(
  publicPath: string | null | undefined,
  expectedCategory?: UploadCategory,
): string | undefined {
  if (!publicPath || publicPath.includes("\\") || publicPath.includes("..")) return undefined;
  const match = /^\/uploads\/(companies|profiles)\/(.+)$/.exec(publicPath);
  if (!match || !isUploadCategory(match[1])) return undefined;
  const category = match[1];
  if (expectedCategory && category !== expectedCategory) return undefined;
  return resolveUploadSegments(category, match[2].split("/"));
}

export function publicPathForStoredFile(
  filePath: string,
  expectedCategory: UploadCategory,
): string {
  const root = uploadRoot();
  const relative = path.relative(root, path.resolve(filePath));
  const segments = relative.split(path.sep);
  const [category, ...assetSegments] = segments;
  if (
    category !== expectedCategory ||
    !safeSegments(assetSegments) ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    throw new AppError(500, "UPLOAD_PATH_INVALID", "Lokasi file upload tidak valid.");
  }
  return `/uploads/${category}/${assetSegments.join("/")}`;
}
