-- Creates the TMS tables on a new, empty database (used when deploying online).
-- Mirrors prisma/schema.prisma. If you change the schema, change this file too,
-- or locally run `npx prisma migrate dev` and copy the SQL it generates.
-- Run automatically by prisma/setup-db.js; safe to run twice (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS `User` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('TENANT', 'LANDLORD') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `User_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Property` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `location` VARCHAR(150) NOT NULL,
  `landlordId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Property_landlordId_idx`(`landlordId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Property_landlordId_fkey` FOREIGN KEY (`landlordId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Unit` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `label` VARCHAR(20) NOT NULL,
  `propertyId` INT NOT NULL,
  `tenantId` INT NULL,
  UNIQUE INDEX `Unit_tenantId_key`(`tenantId`),
  UNIQUE INDEX `Unit_propertyId_label_key`(`propertyId`, `label`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Unit_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Unit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MaintenanceRequest` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `clientId` VARCHAR(36) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `description` TEXT NOT NULL,
  `category` ENUM('PLUMBING', 'ELECTRICAL', 'STRUCTURAL', 'SECURITY', 'APPLIANCE', 'PEST', 'OTHER') NOT NULL,
  `locationInUnit` VARCHAR(60) NULL,
  `status` ENUM('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
  `aiPriority` ENUM('HIGH', 'MEDIUM', 'LOW') NULL,
  `aiConfidence` DOUBLE NULL,
  `priority` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
  `prioritySource` ENUM('AI', 'RULE', 'LANDLORD') NOT NULL,
  `tenantId` INT NOT NULL,
  `unitId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reportedAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `resolvedAt` DATETIME(3) NULL,
  UNIQUE INDEX `MaintenanceRequest_clientId_key`(`clientId`),
  INDEX `MaintenanceRequest_unitId_status_idx`(`unitId`, `status`),
  INDEX `MaintenanceRequest_tenantId_idx`(`tenantId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MaintenanceRequest_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MaintenanceRequest_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RequestPhoto` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `requestId` INT NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `publicId` VARCHAR(200) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RequestPhoto_requestId_idx`(`requestId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RequestPhoto_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `MaintenanceRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StatusHistory` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `requestId` INT NOT NULL,
  `fromStatus` ENUM('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED') NULL,
  `toStatus` ENUM('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED') NOT NULL,
  `note` VARCHAR(255) NULL,
  `changedById` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `StatusHistory_requestId_idx`(`requestId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `StatusHistory_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `MaintenanceRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StatusHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PriorityOverride` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `requestId` INT NOT NULL,
  `fromPriority` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
  `toPriority` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
  `reason` VARCHAR(255) NULL,
  `changedById` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `PriorityOverride_requestId_idx`(`requestId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PriorityOverride_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `MaintenanceRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PriorityOverride_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
