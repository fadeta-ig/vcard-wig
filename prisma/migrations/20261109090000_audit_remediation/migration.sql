ALTER TABLE `ContactProfile`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `firstPublishedAt` DATETIME(3) NULL,
  ADD COLUMN `allowIndexing` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `showWorkPhone` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `showMobilePhone` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `showWhatsapp` BOOLEAN NOT NULL DEFAULT true;

-- Preserve existing search-engine visibility. New profiles default to unlisted.
UPDATE `ContactProfile` SET `allowIndexing` = true;
-- Archived legacy profiles are conservatively URL-locked even if old audit data is absent.
UPDATE `ContactProfile` p
LEFT JOIN (
  SELECT `entityId`, MIN(`createdAt`) AS `firstActiveAt`
  FROM `AuditLog`
  WHERE `entityType` = 'ContactProfile' AND `action` = 'PROFILE_STATUS_CHANGED'
    AND JSON_UNQUOTE(JSON_EXTRACT(`newValues`, '$.status')) = 'ACTIVE'
  GROUP BY `entityId`
) a ON a.`entityId` = p.`id`
SET p.`firstPublishedAt` = COALESCE(p.`publishedAt`, a.`firstActiveAt`,
  CASE WHEN p.`status` IN ('ACTIVE', 'INACTIVE', 'ARCHIVED') THEN p.`createdAt` ELSE NULL END);

CREATE TABLE `ProfileSlugReservation` (
  `slugHash` CHAR(64) NOT NULL,
  `profileId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ProfileSlugReservation_profileId_idx` (`profileId`),
  PRIMARY KEY (`slugHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `ProfileSlugReservation` (`slugHash`, `profileId`)
SELECT SHA2(CONCAT('profile-slug:', `slug`), 256), `id` FROM `ContactProfile`;

CREATE TABLE `EventDedupe` (
  `keyHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  INDEX `EventDedupe_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`keyHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AssetDeletionTask` (
  `id` VARCHAR(191) NOT NULL,
  `publicPath` VARCHAR(500) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `AssetDeletionTask_publicPath_key` (`publicPath`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
