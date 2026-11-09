import { rm } from "node:fs/promises";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePublicUploadPath } from "@/lib/upload-storage";

export async function queueAssetDeletion(
  transaction: Prisma.TransactionClient,
  paths: (string | null)[],
) {
  for (const publicPath of new Set(
    paths.filter((value): value is string => Boolean(value)),
  )) {
    if (!resolvePublicUploadPath(publicPath, "profiles")) continue;
    await transaction.assetDeletionTask.upsert({
      where: { publicPath },
      create: { publicPath },
      update: {},
    });
  }
}

export async function processAssetDeletions(paths?: string[]) {
  const tasks = await prisma.assetDeletionTask.findMany({
    where: paths ? { publicPath: { in: paths } } : undefined,
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  let removed = 0;
  for (const task of tasks) {
    const target = resolvePublicUploadPath(task.publicPath, "profiles");
    try {
      if (target)
        await rm(target, { force: true, maxRetries: 3, retryDelay: 100 });
      await prisma.assetDeletionTask.deleteMany({ where: { id: task.id } });
      removed += 1;
    } catch {
      await prisma.assetDeletionTask.updateMany({
        where: { id: task.id },
        data: { attempts: { increment: 1 } },
      });
    }
  }
  return { removed, pending: tasks.length - removed };
}
