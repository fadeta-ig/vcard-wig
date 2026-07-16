import { z } from "zod";
import {
  PROFILE_SECTIONS,
  PROFILE_SORT_OPTIONS,
  PROFILE_STATUSES,
  RESERVED_PROFILE_SLUGS,
  SOCIAL_PLATFORMS,
} from "@/lib/profile-options";
import { colorContrastRatio } from "@/lib/public-profile";

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .nullable()
    .transform((value) => value || null);

const optionalEmail = z
  .union([z.literal(""), z.email().max(191)])
  .optional()
  .nullable()
  .transform((value) => value?.trim().toLowerCase() || null);

const optionalHttpUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .refine((value) => {
    if (!value) return true;
    try {
      const protocol = new URL(value).protocol;
      return protocol === "https:" || protocol === "http:";
    } catch {
      return false;
    }
  }, "URL harus menggunakan http:// atau https://.")
  .transform((value) => value || null);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9._-]+$/, "Username hanya boleh berisi huruf kecil, angka, titik, underscore, atau tanda hubung.");

export const strongPasswordSchema = z
  .string()
  .min(12, "Password minimal 12 karakter.")
  .max(128, "Password maksimal 128 karakter.");

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(191).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(256),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: strongPasswordSchema,
    confirmation: z.string().min(1).max(128),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmation, {
    path: ["confirmation"],
    message: "Konfirmasi password tidak cocok.",
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "Password baru harus berbeda dari password saat ini.",
  });

export const hexColorSchema = z.string().regex(/^#[0-9A-F]{6}$/i, "Gunakan format warna #RRGGBB.").transform((value) => value.toUpperCase());

export const companySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.");

const companyFields = {
  name: z.string().trim().min(2).max(120),
  slug: companySlugSchema,
  legalName: optionalTrimmedString(160),
  website: optionalHttpUrl,
  email: optionalEmail,
  phone: optionalTrimmedString(32),
  address: optionalTrimmedString(2_000),
  primaryColor: hexColorSchema.default("#1E3A5F"),
  secondaryColor: z
    .union([z.literal(""), hexColorSchema])
    .optional()
    .nullable()
    .transform((value) => value || null),
  qrLogoEnabled: z.boolean().default(false),
  defaultQrForeground: hexColorSchema.default("#111827"),
  defaultQrBackground: hexColorSchema.default("#FFFFFF"),
  isActive: z.boolean().default(true),
};

export const companyCreateSchema = z.object(companyFields).strict();
export const companyUpdateSchema = z
  .object(companyFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diubah.");

const companyIdSchema = z.string().min(20).max(40);

export const adminCreateSchema = z
  .object({
    username: usernameSchema,
    name: z.string().trim().min(2).max(100),
    email: z.email().max(191).transform((value) => value.trim().toLowerCase()),
    password: strongPasswordSchema,
    role: z.enum(["SUPER_ADMIN", "ADMIN"]).default("ADMIN"),
    companyIds: z.array(companyIdSchema).max(100).default([]),
  })
  .strict()
  .refine((value) => value.role === "SUPER_ADMIN" || value.companyIds.length > 0, {
    path: ["companyIds"],
    message: "Admin harus ditugaskan minimal ke satu perusahaan.",
  });

export const adminUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.email().max(191).transform((value) => value.trim().toLowerCase()).optional(),
    role: z.enum(["SUPER_ADMIN", "ADMIN"]).optional(),
    isActive: z.boolean().optional(),
    companyIds: z.array(companyIdSchema).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diubah.");

export const adminResetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmation: z.string().min(1).max(128),
  })
  .strict()
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "Konfirmasi password tidak cocok.",
  });

export const companyContextSchema = z.object({ companyId: companyIdSchema }).strict();

const normalizedPhone = z
  .string()
  .trim()
  .max(32)
  .optional()
  .nullable()
  .transform((value, context) => {
    if (!value) return null;
    const normalized = value
      .replace(/^00/, "+")
      .replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      context.addIssue({
        code: "custom",
        message: "Gunakan format internasional, contoh +628123456789.",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const profileSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug minimal 2 karakter.")
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.")
  .refine((value) => !RESERVED_PROFILE_SLUGS.has(value), "Slug ini digunakan oleh sistem.");

const optionalProfileSlug = z
  .union([z.literal(""), profileSlugSchema])
  .optional()
  .nullable()
  .transform((value) => value || null);

const socialLinkFields = {
  platform: z.enum(SOCIAL_PLATFORMS),
  label: optionalTrimmedString(80),
  username: optionalTrimmedString(100),
  url: z
    .string()
    .trim()
    .min(1, "URL media sosial wajib diisi.")
    .max(500)
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "https:" || protocol === "http:";
      } catch {
        return false;
      }
    }, "URL harus menggunakan http:// atau https://."),
  isActive: z.boolean().default(true),
};

export const socialLinkCreateSchema = z
  .object(socialLinkFields)
  .strict()
  .refine((value) => value.platform !== "CUSTOM" || Boolean(value.label), {
    path: ["label"],
    message: "Label wajib diisi untuk custom link.",
  });

export const socialLinkUpdateSchema = z
  .object(socialLinkFields)
  .partial()
  .extend({ sortOrder: z.number().int().min(0).max(99).optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diubah.");

const sectionOrderSchema = z
  .array(z.enum(PROFILE_SECTIONS))
  .length(PROFILE_SECTIONS.length)
  .refine((value) => new Set(value).size === PROFILE_SECTIONS.length, "Setiap bagian harus muncul tepat satu kali.");

const profileFields = {
  slug: optionalProfileSlug,
  firstName: z.string().trim().min(1, "Nama depan wajib diisi.").max(100),
  lastName: optionalTrimmedString(100),
  displayName: optionalTrimmedString(120),
  honorificPrefix: optionalTrimmedString(30),
  honorificSuffix: optionalTrimmedString(30),
  jobTitle: z.string().trim().min(1, "Jabatan wajib diisi.").max(120),
  department: optionalTrimmedString(120),
  companyName: z.string().trim().min(2, "Nama perusahaan wajib diisi.").max(160),
  email: z
    .string()
    .trim()
    .pipe(z.email("Email belum valid.").max(191))
    .transform((value) => value.toLowerCase()),
  workPhone: normalizedPhone,
  mobilePhone: normalizedPhone,
  whatsappNumber: normalizedPhone,
  website: optionalHttpUrl,
  addressLine1: optionalTrimmedString(255),
  addressLine2: optionalTrimmedString(255),
  city: optionalTrimmedString(100),
  province: optionalTrimmedString(100),
  postalCode: optionalTrimmedString(20),
  country: optionalTrimmedString(100),
  shortBio: optionalTrimmedString(2_000),
  showPhoto: z.boolean().default(true),
  showEmail: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  showAddress: z.boolean().default(true),
  showSocialLinks: z.boolean().default(true),
  sectionOrder: sectionOrderSchema.default([...PROFILE_SECTIONS]),
  socialLinks: z.array(socialLinkCreateSchema).max(20, "Maksimal 20 media sosial.").default([]),
};

export const profileCreateSchema = z.object(profileFields).strict();

const profileUpdateFields = {
  ...profileFields,
  showPhoto: z.boolean(),
  showEmail: z.boolean(),
  showPhone: z.boolean(),
  showAddress: z.boolean(),
  showSocialLinks: z.boolean(),
  sectionOrder: sectionOrderSchema,
  socialLinks: z.array(socialLinkCreateSchema).max(20, "Maksimal 20 media sosial."),
};

export const profileUpdateSchema = z
  .object(profileUpdateFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diubah.");

export const qrExportQuerySchema = z
  .object({
    type: z.enum(["dynamic", "vcard"]).default("dynamic"),
    format: z.enum(["png", "svg"]).default("png"),
    size: z.coerce.number().int().min(256).max(2048).default(512),
    margin: z.coerce.number().int().min(4).max(16).default(4),
    errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M"),
    foreground: hexColorSchema.default("#111827"),
    background: hexColorSchema.default("#FFFFFF"),
    logo: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .strict()
  .superRefine((value, context) => {
    if (colorContrastRatio(value.foreground, value.background) < 4.5) {
      context.addIssue({
        code: "custom",
        path: ["foreground"],
        message: "Kontras warna QR dan latar minimal 4.5:1.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    errorCorrection: value.logo ? ("H" as const) : value.errorCorrection,
  }));

export const profileStatusSchema = z.object({ status: z.enum(PROFILE_STATUSES) }).strict();

export const profileListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(10).max(100).default(20),
    search: z.string().trim().max(120).default(""),
    status: z.enum(PROFILE_STATUSES).optional(),
    department: z.string().trim().max(120).optional(),
    createdFrom: z.iso.date().optional(),
    createdTo: z.iso.date().optional(),
    sort: z.enum(PROFILE_SORT_OPTIONS).default("newest"),
  })
  .strict()
  .refine(
    (value) => !value.createdFrom || !value.createdTo || value.createdFrom <= value.createdTo,
    { path: ["createdTo"], message: "Tanggal akhir harus setelah tanggal awal." },
  );
