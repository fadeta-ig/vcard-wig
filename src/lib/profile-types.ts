import type {
  ProfileSection,
  ProfileStatusValue,
  SocialPlatform,
} from "@/lib/profile-options";

export type CompanyProfileContext = {
  id: string;
  name: string;
  companyLogo: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  qrLogoEnabled: boolean;
  defaultQrForeground: string;
  defaultQrBackground: string;
};

export type SocialLinkView = {
  id: string;
  platform: SocialPlatform;
  label: string | null;
  username: string | null;
  url: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProfileListItemView = {
  id: string;
  slug: string;
  displayName: string;
  firstName: string;
  lastName: string | null;
  jobTitle: string;
  department: string | null;
  companyName: string;
  email: string;
  mobilePhone: string | null;
  workPhone: string | null;
  profileThumbnail: string | null;
  status: ProfileStatusValue;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { socialLinks: number };
};

export type ProfileView = {
  id: string;
  companyId: string;
  slug: string;
  firstName: string;
  lastName: string | null;
  displayName: string;
  honorificPrefix: string | null;
  honorificSuffix: string | null;
  jobTitle: string;
  department: string | null;
  companyName: string;
  email: string;
  workPhone: string | null;
  mobilePhone: string | null;
  whatsappNumber: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  shortBio: string | null;
  profilePhoto: string | null;
  profileThumbnail: string | null;
  status: ProfileStatusValue;
  showPhoto: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showSocialLinks: boolean;
  sectionOrder: ProfileSection[];
  viewCount: number;
  vcardDownloadCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: CompanyProfileContext;
  createdBy: { id: string; name: string; username: string };
  socialLinks: SocialLinkView[];
};

export type ProfileListResultView = {
  items: ProfileListItemView[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: { departments: string[] };
  summary: {
    total: number;
    draft: number;
    active: number;
    inactive: number;
    archived: number;
  };
};
