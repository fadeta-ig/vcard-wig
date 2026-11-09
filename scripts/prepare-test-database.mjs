import "dotenv/config";
import mariadb from "mariadb";
import { spawnSync } from "node:child_process";
import path from "node:path";

const host = process.env.DATABASE_HOST;
const database = process.env.TEST_DATABASE_NAME || "vcard_wig_test";
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) ||
  !/^vcard_[a-z0-9_]*test$/.test(database) ||
  database === process.env.DATABASE_NAME
) {
  throw new Error(
    "Test setup requires a dedicated vcard_*test database on loopback, different from DATABASE_NAME.",
  );
}
const connection = await mariadb.createConnection({
  host,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});
try {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
} finally {
  await connection.end();
}
const url = new URL(`mysql://${host}:${process.env.DATABASE_PORT}/${database}`);
url.username = process.env.DATABASE_USER;
url.password = process.env.DATABASE_PASSWORD || "";
const deployed = spawnSync(
  process.execPath,
  [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
  {
    env: {
      ...process.env,
      DATABASE_NAME: database,
      DATABASE_URL: url.toString(),
    },
    stdio: "inherit",
    windowsHide: true,
  },
);
if (deployed.status !== 0) process.exit(deployed.status || 1);
console.log(
  `Test database ready: ${database}. No application database was changed.`,
);
