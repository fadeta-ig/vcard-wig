import "dotenv/config";
import { mkdir, copyFile, cp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import mariadb from "mariadb";

if (process.env.DATABASE_HOST !== "127.0.0.1")
  throw new Error("Migration drill requires loopback.");
const database = `vcard_migration_${Date.now()}_test`;
if (
  !/^vcard_migration_\d+_test$/.test(database) ||
  database === process.env.DATABASE_NAME
)
  throw new Error("Invalid isolated drill target");
const options = {
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
};
const admin = await mariadb.createConnection(options);
try {
  await admin.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
} finally {
  await admin.end();
}
const temporary = path.resolve(".tmp", database);
await mkdir(path.join(temporary, "migrations"), { recursive: true });
for (const name of [
  "20260715065124_init",
  "20260715144845_phase_6_analytics_security",
]) {
  await cp(
    path.resolve("prisma/migrations", name),
    path.join(temporary, "migrations", name),
    { recursive: true },
  );
}
await copyFile(
  "prisma/migrations/migration_lock.toml",
  path.join(temporary, "migrations/migration_lock.toml"),
);
const configPath = path.join(temporary, "prisma.config.mjs");
await writeFile(
  configPath,
  `export default { schema:${JSON.stringify(path.resolve("prisma/schema.prisma"))}, migrations:{path:${JSON.stringify(path.join(temporary, "migrations"))}}, datasource:{url:process.env.DATABASE_URL} };\n`,
);
const url = new URL(
  `mysql://127.0.0.1:${process.env.DATABASE_PORT}/${database}`,
);
url.username = process.env.DATABASE_USER;
url.password = process.env.DATABASE_PASSWORD || "";
const environment = {
  ...process.env,
  DATABASE_NAME: database,
  DATABASE_URL: url.toString(),
};
function deploy(config) {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("node_modules/prisma/build/index.js"),
      "migrate",
      "deploy",
      ...(config ? ["--config", config] : []),
    ],
    { env: environment, stdio: "inherit", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error("Isolated migration deployment failed");
}
deploy(configPath);
const connection = await mariadb.createConnection({ ...options, database });
try {
  await connection.query(
    "INSERT INTO User (id,username,name,passwordHash,role,updatedAt) VALUES ('legacy-user','legacy-audit-user','Legacy Fixture','not-a-real-password','SUPER_ADMIN',UTC_TIMESTAMP(3))",
  );
  await connection.query(
    "INSERT INTO Company (id,name,slug,updatedAt) VALUES ('legacy-company','Legacy Fixture','legacy-fixture',UTC_TIMESTAMP(3))",
  );
  await connection.query(
    "INSERT INTO ContactProfile (id,companyId,slug,firstName,displayName,jobTitle,companyName,email,status,createdById,updatedAt) VALUES ('legacy-profile','legacy-company','legacy-current','Legacy','Legacy Fixture','Manager','Legacy Fixture','legacy@example.invalid','DRAFT','legacy-user',UTC_TIMESTAMP(3))",
  );
  await connection.query(
    "INSERT INTO AuditLog (id,userId,companyId,action,entityType,entityId,newValues,createdAt) VALUES ('legacy-active','legacy-user','legacy-company','PROFILE_STATUS_CHANGED','ContactProfile','legacy-profile',JSON_OBJECT('status','ACTIVE'),'2026-07-20 00:00:00')",
  );
  await connection.query(
    "INSERT INTO AuditLog (id,userId,companyId,action,entityType,entityId,oldValues,newValues) VALUES ('legacy-rename','legacy-user','legacy-company','PROFILE_UPDATED','ContactProfile','legacy-profile',JSON_OBJECT('slug','legacy-original'),JSON_OBJECT('slug','legacy-current'))",
  );
} finally {
  await connection.end();
}
deploy();
const verify = await mariadb.createConnection({ ...options, database });
try {
  const [profile] = await verify.query(
    "SELECT version,firstPublishedAt,allowIndexing FROM ContactProfile WHERE id='legacy-profile'",
  );
  const [reservations] = await verify.query(
    "SELECT COUNT(*) AS count FROM ProfileSlugReservation WHERE slugHash IN (SHA2('profile-slug:legacy-original',256),SHA2('profile-slug:legacy-current',256))",
  );
  if (
    profile.version !== 1 ||
    !profile.firstPublishedAt ||
    !profile.allowIndexing ||
    Number(reservations.count) !== 2
  )
    throw new Error("Legacy data preservation checks failed");
  const report = {
    status: "passed",
    database,
    legacyProfilePreserved: true,
    version: profile.version,
    firstPublicationPreserved: true,
    existingIndexingPreserved: true,
    currentAndHistoricalSlugReservations: Number(reservations.count),
    sourceDatabaseChanged: false,
  };
  await writeFile(
    "docs/remediation-2026-11-09/migration-drill.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await verify.end();
}
// Deliberately retain the isolated drill database and migration history for review.
