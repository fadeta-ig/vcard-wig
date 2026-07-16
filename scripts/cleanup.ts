import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runRetentionCleanup } from "../src/services/maintenance.service";

try {
  const result = await runRetentionCleanup();
  console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
} catch (error) {
  console.error("Retention cleanup failed.", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
