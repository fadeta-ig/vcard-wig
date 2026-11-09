import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";
import { hashPassword } from "../src/lib/security/password.ts";
import {
  createProfile,
  changeProfileStatus,
} from "../src/services/profile.service.ts";
import { profileCreateSchema } from "../src/lib/validation.ts";

if (
  process.env.DATABASE_NAME !== "vcard_wig_test" ||
  process.env.DATABASE_HOST !== "127.0.0.1"
)
  throw new Error("Preview fixture requires isolated local test database.");
const company = await prisma.company.upsert({
  where: { slug: "audit-preview-company" },
  update: {},
  create: {
    slug: "audit-preview-company",
    name: "A. Contoh Perusahaan WIG",
    legalName: "Contoh Perusahaan WIG",
    primaryColor: "#1E3A5F",
  },
});
const user = await prisma.user.upsert({
  where: { username: "audit-preview" },
  update: {},
  create: {
    username: "audit-preview",
    name: "Admin Contoh",
    role: "SUPER_ADMIN",
    passwordHash: await hashPassword("local-preview-only-2026!"),
  },
});
const session = {
  id: "preview-script",
  user,
  csrfTokenHash: "",
  expiresAt: new Date(Date.now() + 3600000),
  lastSeenAt: new Date(),
};
let profile = await prisma.contactProfile.findFirst({
  where: { companyId: company.id, status: "ACTIVE" },
});
if (!profile) {
  const suffix = Date.now().toString(36);
  profile = await createProfile(
    session,
    company.id,
    profileCreateSchema.parse({
      slug: `profil-contoh-${suffix}`,
      firstName: "Profil",
      lastName: "Contoh",
      honorificPrefix: "Dr.",
      honorificSuffix: "M.M.",
      jobTitle: "Business Development Manager",
      department: "Corporate Relations",
      companyName: "Contoh Perusahaan WIG",
      email: "contoh@example.invalid",
      workPhone: "+12025550123",
      addressLine1: "Jl. Contoh No. 1",
      city: "Jakarta",
      country: "Indonesia",
      shortBio:
        "Profil demonstrasi untuk pemeriksaan tampilan dan alur aplikasi. Seluruh informasi pada kartu ini adalah contoh.",
      socialLinks: [
        {
          platform: "LINKEDIN",
          url: "https://www.linkedin.com",
          label: "LinkedIn",
        },
        {
          platform: "CUSTOM",
          label: "Company profile",
          url: "https://example.org",
        },
      ],
    }),
  );
  profile = await changeProfileStatus(session, profile.id, "ACTIVE");
}
if (
  !(await prisma.contactProfile.count({
    where: { companyId: company.id, status: "ARCHIVED" },
  }))
) {
  const suffix = Date.now().toString(36);
  const archived = await createProfile(
    session,
    company.id,
    profileCreateSchema.parse({
      slug: `arsip-contoh-${suffix}`,
      firstName: "Arsip",
      lastName: "Contoh",
      jobTitle: "Profil arsip",
      companyName: "Contoh Perusahaan WIG",
      email: "arsip@example.invalid",
    }),
  );
  await changeProfileStatus(session, archived.id, "ARCHIVED");
}
console.log(
  JSON.stringify({
    companyId: company.id,
    profileId: profile.id,
    slug: profile.slug,
    username: user.username,
    notice: "Isolated local test fixture; not production data",
  }),
);
await prisma.$disconnect();
