import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import mariadb from "mariadb";

const backupPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
const targetDatabase = process.argv[3] || process.env.RESTORE_DATABASE_NAME || "";
if (!backupPath || !targetDatabase) {
  throw new Error("Usage: npm run db:restore -- <backup.sql> <clean_target_database>");
}
if (!/^[A-Za-z0-9_]+$/.test(targetDatabase)) throw new Error("Invalid restore database name.");
if (targetDatabase === process.env.DATABASE_NAME && process.env.RESTORE_ALLOW_REPLACE !== "true") {
  throw new Error("Refusing to restore over the source database. Use a clean drill database.");
}
await access(backupPath);

async function fileHash(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const input = createReadStream(filePath);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", reject);
    input.on("end", resolve);
  });
  return hash.digest("hex");
}

try {
  const checksum = await readFile(`${backupPath}.sha256`, "utf8");
  const expected = checksum.trim().split(/\s+/)[0];
  const actual = await fileHash(backupPath);
  if (expected !== actual) throw new Error("Backup checksum verification failed.");
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    throw new Error("Backup checksum file is missing.");
  }
  throw error;
}

const connectionOptions = {
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD || "",
};
const administration = await mariadb.createConnection(connectionOptions);
try {
  const existing = await administration.query(
    "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
    [targetDatabase],
  );
  if (existing.length && process.env.RESTORE_ALLOW_REPLACE !== "true") {
    throw new Error("Restore target already exists. Choose a clean database name.");
  }
  if (existing.length) await administration.query(`DROP DATABASE \`${targetDatabase}\``);
  await administration.query(
    `CREATE DATABASE \`${targetDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
} finally {
  await administration.end();
}

async function resolveClientBinary() {
  if (process.env.MYSQL_CLIENT_BIN) return process.env.MYSQL_CLIENT_BIN;
  const xampp = "C:\\xampp\\mysql\\bin\\mysql.exe";
  if (process.platform === "win32") {
    try {
      await access(xampp);
      return xampp;
    } catch {
      return "mysql";
    }
  }
  return "mariadb";
}

const child = spawn(
  await resolveClientBinary(),
  [
    `--host=${process.env.DATABASE_HOST}`,
    `--port=${process.env.DATABASE_PORT}`,
    `--user=${process.env.DATABASE_USER}`,
    "--default-character-set=utf8mb4",
    targetDatabase,
  ],
  {
    env: { ...process.env, MYSQL_PWD: process.env.DATABASE_PASSWORD || "" },
    stdio: ["pipe", "ignore", "pipe"],
    windowsHide: true,
  },
);
createReadStream(backupPath).pipe(child.stdin);
let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});
const exitCode = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("close", resolve);
});
if (exitCode !== 0) throw new Error(`Database restore failed: ${stderr.trim()}`);

const verification = await mariadb.createConnection({ ...connectionOptions, database: targetDatabase });
try {
  const tables = await verification.query(
    "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [targetDatabase],
  );
  const migrations = await verification.query("SELECT COUNT(*) AS total FROM _prisma_migrations");
  const companies = await verification.query("SELECT COUNT(*) AS total FROM Company");
  const profiles = await verification.query("SELECT COUNT(*) AS total FROM ContactProfile");
  console.log(JSON.stringify({
    status: "ok",
    database: targetDatabase,
    tables: Number(tables[0].total),
    migrations: Number(migrations[0].total),
    companies: Number(companies[0].total),
    profiles: Number(profiles[0].total),
  }, null, 2));
} finally {
  await verification.end();
}

