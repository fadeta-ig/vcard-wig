import "dotenv/config";
import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const apply = process.argv.includes("--apply");
const allowExternalStorage = process.argv.includes("--allow-external-storage");
const workspace = path.resolve(process.cwd());
const source = path.resolve(
  process.env.UPLOAD_DIR || "public/uploads",
  "profiles",
);
const destination = path.resolve(
  process.env.PRIVATE_UPLOAD_DIR || "storage/private/profile-photos",
);
const backup = path.resolve(
  "backups",
  `profile-photos-before-private-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
function within(root, target) {
  const relative = path.relative(root, target);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}
if (
  (!allowExternalStorage &&
    (!within(workspace, source) || !within(workspace, destination))) ||
  within(path.resolve("public"), destination) ||
  source === destination ||
  within(source, destination) ||
  within(destination, source)
)
  throw new Error(
    "Migration roots overlap or are outside the workspace. Review dry-run paths and explicitly allow external storage when required. Destination must be outside public/.",
  );
async function checkAncestors(target) {
  let cursor = target;
  while (cursor !== path.dirname(cursor)) {
    try {
      if ((await lstat(cursor)).isSymbolicLink())
        throw new Error("Symlinks are not allowed in migration roots");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    cursor = path.dirname(cursor);
  }
}
await checkAncestors(source);
await checkAncestors(destination);
await checkAncestors(backup);
const files = [];
async function collect(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const target = path.resolve(directory, entry.name);
    if (!within(source, target)) throw new Error("Path escapes source root");
    const info = await lstat(target);
    if (info.isSymbolicLink())
      throw new Error("Symlinks are not allowed in photo migration");
    if (info.isDirectory()) await collect(target);
    else if (info.isFile() && /\.(webp|jpe?g|png)$/i.test(entry.name))
      files.push(target);
  }
}
await collect(source);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = [];
for (const original of files) {
  const relative = path.relative(source, original);
  const target = path.resolve(destination, relative);
  const backupFile = path.resolve(backup, relative);
  if (!within(destination, target) || !within(backup, backupFile))
    throw new Error("Invalid destination path");
  const bytes = await readFile(original);
  const digest = hash(bytes);
  manifest.push({ relative, sha256: digest });
  if (!apply) continue;
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await mkdir(path.dirname(backupFile), { recursive: true, mode: 0o700 });
  await checkAncestors(target);
  await checkAncestors(backupFile);
  try {
    await copyFile(original, target, 1);
  } catch (error) {
    if (error.code !== "EEXIST" || hash(await readFile(target)) !== digest)
      throw error;
  }
  await copyFile(original, backupFile, 1);
  if (
    hash(await readFile(target)) !== digest ||
    hash(await readFile(backupFile)) !== digest
  )
    throw new Error("Photo checksum verification failed; original retained");
  // Only a verified individual source file is removed. No recursive delete or move.
  await writeFile(
    path.join(backup, "manifest.json"),
    JSON.stringify({ source, destination, files: manifest }, null, 2),
    { mode: 0o600 },
  );
  await unlink(original);
}

console.log(
  JSON.stringify({
    mode: apply ? "applied" : "dry-run",
    files: manifest.length,
    source,
    destination,
    backup: apply && manifest.length ? backup : null,
  }),
);
