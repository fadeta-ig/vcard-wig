ALTER TABLE `User`
  ADD COLUMN `mfaSecretEncrypted` TEXT NULL,
  ADD COLUMN `mfaPendingSecret` TEXT NULL,
  ADD COLUMN `mfaPendingSession` VARCHAR(191) NULL,
  ADD COLUMN `mfaPendingExpires` DATETIME(3) NULL,
  ADD COLUMN `mfaLastCounter` BIGINT NULL;
CREATE TABLE `MfaRecoveryCode` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  UNIQUE INDEX `MfaRecoveryCode_codeHash_key` (`codeHash`),
  INDEX `MfaRecoveryCode_userId_idx` (`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MfaRecoveryCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
