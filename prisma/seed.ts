import "dotenv/config";
import argon2 from "argon2";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, UserRole } from "../src/generated/prisma/client";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} wajib diisi untuk seed.`);
  }
  return value;
};

const adapter = new PrismaMariaDb({
  host: required("DATABASE_HOST"),
  port: Number(required("DATABASE_PORT")),
  user: required("DATABASE_USER"),
  password: process.env.DATABASE_PASSWORD ?? "",
  database: required("DATABASE_NAME"),
  connectionLimit: 1,
  timezone: "Z",
});

const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const username = required("SEED_ADMIN_USERNAME").trim().toLowerCase();
  const name = required("SEED_ADMIN_NAME").trim();
  const password = required("SEED_ADMIN_PASSWORD");
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || null;

  if (password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD sementara minimal 8 karakter.");
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.upsert({
    where: { username },
    update: {
      name,
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      mustChangePassword: password.length < 12,
    },
    create: {
      username,
      name,
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      mustChangePassword: password.length < 12,
    },
  });

  console.info(`Seed Super Admin '${username}' berhasil.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed gagal.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
