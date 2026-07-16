import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

for (const name of ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_NAME"]) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

async function resolveDumpBinary() {
  if (process.env.MYSQL_DUMP_BIN) return process.env.MYSQL_DUMP_BIN;
  const xampp = "C:\\xampp\\mysql\\bin\\mysqldump.exe";
  if (process.platform === "win32") {
    try {
      await access(xampp);
      return xampp;
    } catch {
      return "mysqldump";
    }
  }
  return "mariadb-dump";
}

const backupDirectory = path.resolve(process.env.BACKUP_DIR || "backups");
await mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const fileName = `${process.env.DATABASE_NAME}-${timestamp}.sql`;
const outputPath = path.join(backupDirectory, fileName);
const dumpBinary = await resolveDumpBinary();
const args = [
  `--host=${process.env.DATABASE_HOST}`,
  `--port=${process.env.DATABASE_PORT}`,
  `--user=${process.env.DATABASE_USER}`,
  "--single-transaction",
  "--quick",
  "--routines",
  "--triggers",
  "--events",
  "--hex-blob",
  "--skip-lock-tables",
  "--default-character-set=utf8mb4",
  process.env.DATABASE_NAME,
];
const child = spawn(dumpBinary, args, {
  env: { ...process.env, MYSQL_PWD: process.env.DATABASE_PASSWORD || "" },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const output = createWriteStream(outputPath, { flags: "wx", mode: 0o600 });
child.stdout.pipe(output);
let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});
const childDone = new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("close", resolve);
});
const outputDone = new Promise((resolve, reject) => {
  output.on("error", reject);
  output.on("close", resolve);
});
const [exitCode] = await Promise.all([childDone, outputDone]);
if (exitCode !== 0) {
  await rm(outputPath, { force: true });
  throw new Error(`Database backup failed with exit code ${exitCode}: ${stderr.trim()}`);
}

const hash = createHash("sha256");
await new Promise((resolve, reject) => {
  const input = createReadStream(outputPath);
  input.on("data", (chunk) => hash.update(chunk));
  input.on("error", reject);
  input.on("end", resolve);
});
const digest = hash.digest("hex");
await writeFile(`${outputPath}.sha256`, `${digest}  ${fileName}\n`, { mode: 0o600 });
console.log(JSON.stringify({ status: "ok", backup: outputPath, sha256: digest }, null, 2));
