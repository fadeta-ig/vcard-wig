-- AlterTable
ALTER TABLE `ActivityEvent` ADD COLUMN `visitorTokenHash` CHAR(64) NULL;

-- CreateTable
CREATE TABLE `PublicRateLimit` (
    `keyHash` CHAR(64) NOT NULL,
    `windowStartedAt` DATETIME(3) NOT NULL,
    `requestCount` INTEGER NOT NULL DEFAULT 1,
    `expiresAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PublicRateLimit_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`keyHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ActivityEvent_contactProfileId_visitorTokenHash_eventType_cr_idx` ON `ActivityEvent`(`contactProfileId`, `visitorTokenHash`, `eventType`, `createdAt`);
