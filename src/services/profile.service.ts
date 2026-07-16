import {
  Prisma,
  ProfileStatus,
  UserRole,
} from "@/generated/prisma/client";
import type { z } from "zod";
import { AppError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PROFILE_SECTION_ORDER,
  PROFILE_SECTIONS,
  RESERVED_PROFILE_SLUGS,
  slugifyProfile,
  socialPlatformIcon,
  type ProfileSection,
  type SocialPlatform,
} from "@/lib/profile-options";
import type {
  profileCreateSchema,
  profileListQuerySchema,
  profileUpdateSchema,
  socialLinkCreateSchema,
  socialLinkUpdateSchema,
} from "@/lib/validation";
import { assertCompanyAccess } from "@/services/authorization.service";
import type { AuthenticatedSession } from "@/services/auth.service";

type ProfileCreateInput = z.infer<typeof profileCreateSchema>;
type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
type ProfileListInput = z.infer<typeof profileListQuerySchema>;
type SocialLinkCreateInput = z.infer<typeof socialLinkCreateSchema>;
type SocialLinkUpdateInput = z.infer<typeof socialLinkUpdateSchema>;

const profileListSelect = {
  id: true,
  slug: true,
  displayName: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  department: true,
  companyName: true,
  email: true,
  mobilePhone: true,
  workPhone: true,
  profileThumbnail: true,
  status: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { socialLinks: true } },
} as const;

export const profileDetailSelect = {
  id: true,
  companyId: true,
  slug: true,
  firstName: true,
  lastName: true,
  displayName: true,
  honorificPrefix: true,
  honorificSuffix: true,
  jobTitle: true,
  department: true,
  companyName: true,
  email: true,
  workPhone: true,
  mobilePhone: true,
  whatsappNumber: true,
  website: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  shortBio: true,
  profilePhoto: true,
  profileThumbnail: true,
  status: true,
  showPhoto: true,
  showEmail: true,
  showPhone: true,
  showAddress: true,
  showSocialLinks: true,
  sectionOrder: true,
  viewCount: true,
  vcardDownloadCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  company: {
    select: {
      id: true,
      name: true,
      companyLogo: true,
      primaryColor: true,
      secondaryColor: true,
      qrLogoEnabled: true,
      defaultQrForeground: true,
      defaultQrBackground: true,
    },
  },
  createdBy: { select: { id: true, name: true, username: true } },
  socialLinks: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      platform: true,
      label: true,
      username: true,
      url: true,
      icon: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ContactProfileSelect;

type ProfileDetail = Prisma.ContactProfileGetPayload<{ select: typeof profileDetailSelect }>;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export function normalizeProfileSectionOrder(value: Prisma.JsonValue | null): ProfileSection[] {
  if (
    Array.isArray(value) &&
    value.length === PROFILE_SECTIONS.length &&
    new Set(value).size === PROFILE_SECTIONS.length &&
    value.every((item) =>
      typeof item === "string" && (PROFILE_SECTIONS as readonly string[]).includes(item),
    )
  ) {
    return value as ProfileSection[];
  }
  return [...DEFAULT_PROFILE_SECTION_ORDER];
}

function normalizedProfile<T extends ProfileDetail>(profile: T) {
  return {
    ...profile,
    sectionOrder: normalizeProfileSectionOrder(profile.sectionOrder),
  };
}

function displayNameFor(input: {
  displayName?: string | null;
  firstName: string;
  lastName?: string | null;
}): string {
  return input.displayName || [input.firstName, input.lastName].filter(Boolean).join(" ");
}

function baseSlugFor(value: string): string {
  const slug = slugifyProfile(value);
  if (!slug || slug.length < 2) return "contact";
  return RESERVED_PROFILE_SLUGS.has(slug) ? `contact-${slug}` : slug;
}

function slugWithSuffix(base: string, sequence: number): string {
  if (sequence === 1) return base;
  const suffix = `-${sequence}`;
  return `${base.slice(0, 100 - suffix.length).replace(/-+$/g, "")}${suffix}`;
}

function normalizedSocialLinks(links: SocialLinkCreateInput[]) {
  return links.map((link, index) => ({
    platform: link.platform,
    label: link.label,
    username: link.username,
    url: link.url,
    icon: socialPlatformIcon(link.platform),
    sortOrder: index,
    isActive: link.isActive,
  }));
}

function auditSnapshot(profile: {
  slug: string;
  displayName: string;
  jobTitle: string;
  status: ProfileStatus;
  department: string | null;
  companyName: string;
  profilePhoto: string | null;
  socialLinks?: { isActive: boolean }[];
}) {
  return {
    slug: profile.slug,
    displayName: profile.displayName,
    jobTitle: profile.jobTitle,
    status: profile.status,
    department: profile.department,
    companyName: profile.companyName,
    hasPhoto: Boolean(profile.profilePhoto),
    socialLinkCount: profile.socialLinks?.length ?? 0,
    activeSocialLinkCount: profile.socialLinks?.filter((link) => link.isActive).length ?? 0,
  };
}

function changedProfileFields(existing: ProfileDetail, updated: ProfileDetail): string[] {
  const fields = [
    "slug",
    "firstName",
    "lastName",
    "displayName",
    "honorificPrefix",
    "honorificSuffix",
    "jobTitle",
    "department",
    "companyName",
    "email",
    "workPhone",
    "mobilePhone",
    "whatsappNumber",
    "website",
    "addressLine1",
    "addressLine2",
    "city",
    "province",
    "postalCode",
    "country",
    "shortBio",
    "showPhoto",
    "showEmail",
    "showPhone",
    "showAddress",
    "showSocialLinks",
    "sectionOrder",
  ] as const;
  const changed: string[] = fields.filter(
    (field) => JSON.stringify(existing[field]) !== JSON.stringify(updated[field]),
  );
  const existingSocials = existing.socialLinks.map(({ platform, label, username, url, sortOrder, isActive }) => ({
    platform,
    label,
    username,
    url,
    sortOrder,
    isActive,
  }));
  const updatedSocials = updated.socialLinks.map(({ platform, label, username, url, sortOrder, isActive }) => ({
    platform,
    label,
    username,
    url,
    sortOrder,
    isActive,
  }));
  if (JSON.stringify(existingSocials) !== JSON.stringify(updatedSocials)) changed.push("socialLinks");
  return changed;
}

function jakartaBoundary(date: string, endOfDay: boolean): Date {
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
}

export async function listProfiles(
  session: AuthenticatedSession,
  companyId: string,
  input: ProfileListInput,
) {
  await assertCompanyAccess(session, companyId);

  const where: Prisma.ContactProfileWhereInput = {
    companyId,
    status: input.status ?? { not: ProfileStatus.ARCHIVED },
  };
  if (input.search) {
    where.OR = [
      { displayName: { contains: input.search } },
      { firstName: { contains: input.search } },
      { lastName: { contains: input.search } },
      { email: { contains: input.search } },
      { jobTitle: { contains: input.search } },
      { department: { contains: input.search } },
      { companyName: { contains: input.search } },
      { workPhone: { contains: input.search } },
      { mobilePhone: { contains: input.search } },
      { whatsappNumber: { contains: input.search } },
    ];
  }
  if (input.department) where.department = input.department;
  if (input.createdFrom || input.createdTo) {
    where.createdAt = {
      ...(input.createdFrom ? { gte: jakartaBoundary(input.createdFrom, false) } : {}),
      ...(input.createdTo ? { lte: jakartaBoundary(input.createdTo, true) } : {}),
    };
  }

  const orderBy: Prisma.ContactProfileOrderByWithRelationInput[] =
    input.sort === "oldest"
      ? [{ createdAt: "asc" }]
      : input.sort === "name_asc"
        ? [{ displayName: "asc" }, { createdAt: "desc" }]
        : input.sort === "most_viewed"
          ? [{ viewCount: "desc" }, { displayName: "asc" }]
          : [{ createdAt: "desc" }];

  const [items, totalItems, departmentRows, groupedStatuses] = await prisma.$transaction([
    prisma.contactProfile.findMany({
      where,
      select: profileListSelect,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.contactProfile.count({ where }),
    prisma.contactProfile.findMany({
      where: { companyId, department: { not: null } },
      distinct: ["department"],
      select: { department: true },
      orderBy: { department: "asc" },
    }),
    prisma.contactProfile.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(groupedStatuses.map((row) => [row.status, row._count._all]));
  const summary = {
    draft: counts.get(ProfileStatus.DRAFT) ?? 0,
    active: counts.get(ProfileStatus.ACTIVE) ?? 0,
    inactive: counts.get(ProfileStatus.INACTIVE) ?? 0,
    archived: counts.get(ProfileStatus.ARCHIVED) ?? 0,
  };

  return {
    items,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / input.pageSize)),
    },
    filters: {
      departments: departmentRows
        .map((row) => row.department)
        .filter((value): value is string => Boolean(value)),
    },
    summary: { ...summary, total: Object.values(summary).reduce((sum, count) => sum + count, 0) },
  };
}

export async function getProfileForSession(
  session: AuthenticatedSession,
  profileId: string,
): Promise<ReturnType<typeof normalizedProfile>> {
  const profile = await prisma.contactProfile.findUnique({
    where: { id: profileId },
    select: profileDetailSelect,
  });
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profil tidak ditemukan.");
  await assertCompanyAccess(session, profile.companyId);
  return normalizedProfile(profile);
}

export async function createProfile(
  session: AuthenticatedSession,
  companyId: string,
  input: ProfileCreateInput,
) {
  await assertCompanyAccess(session, companyId);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, isActive: true },
  });
  if (!company?.isActive) throw new AppError(404, "COMPANY_NOT_FOUND", "Perusahaan tidak ditemukan.");

  const displayName = displayNameFor(input);
  const explicitSlug = input.slug;
  const baseSlug = explicitSlug ?? baseSlugFor(displayName);
  const socialLinks = normalizedSocialLinks(input.socialLinks);
  const { sectionOrder } = input;
  const profileFields = {
    firstName: input.firstName,
    lastName: input.lastName,
    honorificPrefix: input.honorificPrefix,
    honorificSuffix: input.honorificSuffix,
    jobTitle: input.jobTitle,
    department: input.department,
    companyName: input.companyName,
    email: input.email,
    workPhone: input.workPhone,
    mobilePhone: input.mobilePhone,
    whatsappNumber: input.whatsappNumber,
    website: input.website,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    province: input.province,
    postalCode: input.postalCode,
    country: input.country,
    shortBio: input.shortBio,
    showPhoto: input.showPhoto,
    showEmail: input.showEmail,
    showPhone: input.showPhone,
    showAddress: input.showAddress,
    showSocialLinks: input.showSocialLinks,
  };

  for (let sequence = 1; sequence <= 100; sequence += 1) {
    const slug = slugWithSuffix(baseSlug, sequence);
    if (explicitSlug && sequence > 1) {
      throw new AppError(409, "PROFILE_SLUG_CONFLICT", "Slug profil sudah digunakan.");
    }

    try {
      const created = await prisma.$transaction(async (transaction) => {
        const profile = await transaction.contactProfile.create({
          data: {
            ...profileFields,
            companyId,
            createdById: session.user.id,
            slug,
            displayName,
            sectionOrder: sectionOrder as Prisma.InputJsonValue,
            socialLinks: { create: socialLinks },
          },
          select: profileDetailSelect,
        });
        await transaction.auditLog.create({
          data: {
            userId: session.user.id,
            companyId,
            action: "PROFILE_CREATED",
            entityType: "ContactProfile",
            entityId: profile.id,
            newValues: auditSnapshot(profile),
          },
        });
        return profile;
      });
      return normalizedProfile(created);
    } catch (error) {
      if (isUniqueConstraintError(error)) continue;
      throw error;
    }
  }

  throw new AppError(409, "PROFILE_SLUG_CONFLICT", "Slug profil tidak dapat dialokasikan.");
}

const mutableProfileFields = [
  "firstName",
  "lastName",
  "honorificPrefix",
  "honorificSuffix",
  "jobTitle",
  "department",
  "companyName",
  "email",
  "workPhone",
  "mobilePhone",
  "whatsappNumber",
  "website",
  "addressLine1",
  "addressLine2",
  "city",
  "province",
  "postalCode",
  "country",
  "shortBio",
  "showPhoto",
  "showEmail",
  "showPhone",
  "showAddress",
  "showSocialLinks",
] as const;

export async function updateProfile(
  session: AuthenticatedSession,
  profileId: string,
  input: ProfileUpdateInput,
) {
  const existing = await getProfileForSession(session, profileId);
  const updateData: Prisma.ContactProfileUncheckedUpdateInput = {};

  for (const field of mutableProfileFields) {
    const value = input[field];
    if (value !== undefined) {
      (updateData as Record<string, unknown>)[field] = value;
    }
  }

  const finalFirstName = input.firstName ?? existing.firstName;
  const finalLastName = input.lastName === undefined ? existing.lastName : input.lastName;
  const finalDisplayName =
    input.displayName === undefined
      ? existing.displayName
      : displayNameFor({
          displayName: input.displayName,
          firstName: finalFirstName,
          lastName: finalLastName,
        });
  if (input.displayName !== undefined) updateData.displayName = finalDisplayName;

  if (input.slug !== undefined) {
    const nextSlug = input.slug ?? baseSlugFor(finalDisplayName);
    if (existing.publishedAt && nextSlug !== existing.slug) {
      throw new AppError(
        409,
        "PROFILE_SLUG_LOCKED",
        "Slug tidak dapat diubah setelah profil pernah dipublikasikan agar QR lama tetap berlaku.",
      );
    }
    const duplicate = await prisma.contactProfile.count({
      where: { slug: nextSlug, id: { not: profileId } },
    });
    if (duplicate) {
      throw new AppError(409, "PROFILE_SLUG_CONFLICT", "Slug profil sudah digunakan.");
    }
    updateData.slug = nextSlug;
  }
  if (input.sectionOrder !== undefined) {
    updateData.sectionOrder = input.sectionOrder as Prisma.InputJsonValue;
  }
  if (input.socialLinks !== undefined) {
    updateData.socialLinks = {
      deleteMany: {},
      create: normalizedSocialLinks(input.socialLinks),
    };
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const profile = await transaction.contactProfile.update({
      where: { id: profileId },
      data: updateData,
      select: profileDetailSelect,
    });
    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        companyId: existing.companyId,
        action: "PROFILE_UPDATED",
        entityType: "ContactProfile",
        entityId: profileId,
        oldValues: {
          ...auditSnapshot(existing),
          changedFields: changedProfileFields(existing, profile),
        },
        newValues: {
          ...auditSnapshot(profile),
          changedFields: changedProfileFields(existing, profile),
        },
      },
    });
    return profile;
  });
  return normalizedProfile(updated);
}

const allowedStatusTransitions: Record<ProfileStatus, ProfileStatus[]> = {
  [ProfileStatus.DRAFT]: [ProfileStatus.ACTIVE, ProfileStatus.ARCHIVED],
  [ProfileStatus.ACTIVE]: [ProfileStatus.INACTIVE, ProfileStatus.ARCHIVED],
  [ProfileStatus.INACTIVE]: [ProfileStatus.ACTIVE, ProfileStatus.ARCHIVED],
  [ProfileStatus.ARCHIVED]: [ProfileStatus.DRAFT],
};

export async function changeProfileStatus(
  session: AuthenticatedSession,
  profileId: string,
  nextStatus: ProfileStatus,
) {
  const existing = await getProfileForSession(session, profileId);
  if (existing.status === nextStatus) return existing;
  if (!allowedStatusTransitions[existing.status].includes(nextStatus)) {
    throw new AppError(
      409,
      "PROFILE_STATUS_TRANSITION_INVALID",
      `Status ${existing.status} tidak dapat langsung diubah menjadi ${nextStatus}.`,
    );
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const profile = await transaction.contactProfile.update({
      where: { id: profileId },
      data: {
        status: nextStatus,
        ...(nextStatus === ProfileStatus.ACTIVE && !existing.publishedAt
          ? { publishedAt: new Date() }
          : {}),
        ...(nextStatus === ProfileStatus.DRAFT ? { publishedAt: null } : {}),
      },
      select: profileDetailSelect,
    });
    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        companyId: existing.companyId,
        action: "PROFILE_STATUS_CHANGED",
        entityType: "ContactProfile",
        entityId: profileId,
        oldValues: { status: existing.status },
        newValues: { status: nextStatus },
      },
    });
    return profile;
  });
  return normalizedProfile(updated);
}

export function archiveProfile(session: AuthenticatedSession, profileId: string) {
  return changeProfileStatus(session, profileId, ProfileStatus.ARCHIVED);
}

export async function createSocialLink(
  session: AuthenticatedSession,
  profileId: string,
  input: SocialLinkCreateInput,
) {
  const profile = await getProfileForSession(session, profileId);
  if (profile.socialLinks.length >= 20) {
    throw new AppError(422, "SOCIAL_LINK_LIMIT_REACHED", "Maksimal 20 media sosial per profil.");
  }
  const maximum = await prisma.socialLink.aggregate({
    where: { contactProfileId: profileId },
    _max: { sortOrder: true },
  });
  const link = await prisma.$transaction(async (transaction) => {
    const created = await transaction.socialLink.create({
      data: {
        contactProfileId: profileId,
        ...input,
        icon: socialPlatformIcon(input.platform),
        sortOrder: (maximum._max.sortOrder ?? -1) + 1,
      },
    });
    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        companyId: profile.companyId,
        action: "SOCIAL_LINK_CREATED",
        entityType: "SocialLink",
        entityId: created.id,
        newValues: { platform: created.platform, isActive: created.isActive },
      },
    });
    return created;
  });
  return link;
}

export async function updateSocialLink(
  session: AuthenticatedSession,
  socialLinkId: string,
  input: SocialLinkUpdateInput,
) {
  const existing = await prisma.socialLink.findUnique({
    where: { id: socialLinkId },
    include: { contactProfile: { select: { companyId: true } } },
  });
  if (!existing) throw new AppError(404, "SOCIAL_LINK_NOT_FOUND", "Media sosial tidak ditemukan.");
  await assertCompanyAccess(session, existing.contactProfile.companyId);

  const platform = (input.platform ?? existing.platform) as SocialPlatform;
  const label = input.label === undefined ? existing.label : input.label;
  if (platform === "CUSTOM" && !label) {
    throw new AppError(422, "SOCIAL_LABEL_REQUIRED", "Label wajib diisi untuk custom link.");
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const link = await transaction.socialLink.update({
      where: { id: socialLinkId },
      data: {
        ...input,
        platform,
        label,
        icon: socialPlatformIcon(platform),
      },
    });
    await transaction.auditLog.create({
      data: {
        userId: session.user.id,
        companyId: existing.contactProfile.companyId,
        action: "SOCIAL_LINK_UPDATED",
        entityType: "SocialLink",
        entityId: socialLinkId,
        oldValues: { platform: existing.platform, isActive: existing.isActive },
        newValues: { platform: link.platform, isActive: link.isActive },
      },
    });
    return link;
  });
  return updated;
}

export async function deleteSocialLink(
  session: AuthenticatedSession,
  socialLinkId: string,
): Promise<void> {
  const existing = await prisma.socialLink.findUnique({
    where: { id: socialLinkId },
    include: { contactProfile: { select: { companyId: true } } },
  });
  if (!existing) throw new AppError(404, "SOCIAL_LINK_NOT_FOUND", "Media sosial tidak ditemukan.");
  await assertCompanyAccess(session, existing.contactProfile.companyId);
  await prisma.$transaction([
    prisma.socialLink.delete({ where: { id: socialLinkId } }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        companyId: existing.contactProfile.companyId,
        action: "SOCIAL_LINK_DELETED",
        entityType: "SocialLink",
        entityId: socialLinkId,
        oldValues: { platform: existing.platform, isActive: existing.isActive },
      },
    }),
  ]);
}

export function sessionCanManageCompany(
  session: AuthenticatedSession,
  companyId: string,
): Promise<void> {
  if (session.user.role === UserRole.SUPER_ADMIN) return assertCompanyAccess(session, companyId);
  return assertCompanyAccess(session, companyId);
}
