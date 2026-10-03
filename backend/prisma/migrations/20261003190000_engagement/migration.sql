-- Birth dates are now set only by an approved verification (KycRequest); unverified ones are dropped.
UPDATE `User` SET `birthDate` = NULL;

-- AlterTable
ALTER TABLE `PointMovement` ADD COLUMN `checkInId` INTEGER NULL,
    ADD COLUMN `spinId` INTEGER NULL,
    MODIFY `type` ENUM('PURCHASE', 'MISSION', 'PROMOTION', 'EVENT', 'REDEMPTION', 'ADJUSTMENT', 'REVERSAL', 'CHECK_IN', 'SPIN', 'BIRTHDAY', 'EXPIRATION') NOT NULL;

-- AlterTable
ALTER TABLE `StatusMovement` ADD COLUMN `checkInId` INTEGER NULL,
    MODIFY `type` ENUM('PURCHASE', 'MISSION', 'DISCOVERY', 'STREAK', 'ADJUSTMENT', 'WELCOME', 'CHECK_IN') NOT NULL;

-- AlterTable
ALTER TABLE `Redemption` ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `origin` ENUM('POINTS', 'PRIZE', 'BIRTHDAY') NOT NULL DEFAULT 'POINTS';

-- AlterTable
ALTER TABLE `Mission` ADD COLUMN `rewardSpins` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Promotion` ADD COLUMN `origin` ENUM('MANUAL', 'REACTIVATION', 'ANNIVERSARY', 'VISIT_CARD', 'PRIZE') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `singleUse` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `userId` INTEGER NULL;

-- AlterTable
ALTER TABLE `FraudAlert` ADD COLUMN `checkInId` INTEGER NULL,
    MODIFY `type` ENUM('DUPLICATE_TRANSACTION', 'REUSED_REDEMPTION', 'HIGH_FREQUENCY', 'ABNORMAL_AMOUNT', 'CHECK_IN_ONLY') NOT NULL;

-- CreateTable
CREATE TABLE `Space` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `location` VARCHAR(150) NULL,
    `code` VARCHAR(20) NOT NULL,
    `pointsReward` INTEGER NOT NULL DEFAULT 0,
    `statusReward` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Space_code_key`(`code`),
    INDEX `Space_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SpaceCheckIn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `spaceId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `day` CHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SpaceCheckIn_userId_idx`(`userId`),
    UNIQUE INDEX `SpaceCheckIn_spaceId_userId_day_key`(`spaceId`, `userId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SpinPrize` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('POINTS', 'MULTIPLIER', 'REWARD', 'EXTRA_SPIN') NOT NULL,
    `points` INTEGER NULL,
    `multiplier` DECIMAL(4, 2) NULL,
    `rewardId` INTEGER NULL,
    `validDays` INTEGER NOT NULL DEFAULT 7,
    `weight` INTEGER NOT NULL,
    `stock` INTEGER NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdById` INTEGER NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `SpinPrize_rewardId_idx`(`rewardId`),
    INDEX `SpinPrize_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Spin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `source` ENUM('DAILY', 'EXTRA', 'FREE') NOT NULL,
    `cost` INTEGER NOT NULL DEFAULT 0,
    `prizeId` INTEGER NOT NULL,
    `prizeType` ENUM('POINTS', 'MULTIPLIER', 'REWARD', 'EXTRA_SPIN') NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `promotionId` INTEGER NULL,
    `redemptionId` INTEGER NULL,
    `unlockTransactionId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Spin_redemptionId_key`(`redemptionId`),
    UNIQUE INDEX `Spin_unlockTransactionId_key`(`unlockTransactionId`),
    INDEX `Spin_userId_idx`(`userId`),
    INDEX `Spin_prizeId_idx`(`prizeId`),
    INDEX `Spin_promotionId_idx`(`promotionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KycRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `birthDate` DATE NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedById` INTEGER NULL,
    `reviewNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,

    INDEX `KycRequest_userId_idx`(`userId`),
    INDEX `KycRequest_status_idx`(`status`),
    INDEX `KycRequest_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KycDocument` (
    `requestId` INTEGER NOT NULL,
    `mimeType` VARCHAR(50) NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`requestId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BirthdayPerk` (
    `businessId` INTEGER NOT NULL,
    `type` ENUM('PERCENT_DISCOUNT', 'AMOUNT_DISCOUNT', 'FREE_PRODUCT') NOT NULL,
    `discountPercent` INTEGER NULL,
    `discountAmount` DECIMAL(10, 2) NULL,
    `catalogItemId` INTEGER NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BirthdayPerk_catalogItemId_idx`(`catalogItemId`),
    PRIMARY KEY (`businessId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BirthdayClaim` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `businessId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `transactionId` INTEGER NOT NULL,
    `validatedById` INTEGER NOT NULL,
    `perkTitle` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BirthdayClaim_businessId_idx`(`businessId`),
    INDEX `BirthdayClaim_transactionId_idx`(`transactionId`),
    INDEX `BirthdayClaim_validatedById_idx`(`validatedById`),
    UNIQUE INDEX `BirthdayClaim_userId_businessId_year_key`(`userId`, `businessId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PointMovement_checkInId_idx` ON `PointMovement`(`checkInId`);

-- CreateIndex
CREATE INDEX `PointMovement_spinId_idx` ON `PointMovement`(`spinId`);

-- CreateIndex
CREATE INDEX `StatusMovement_checkInId_idx` ON `StatusMovement`(`checkInId`);

-- CreateIndex
CREATE INDEX `Promotion_userId_idx` ON `Promotion`(`userId`);

-- CreateIndex
CREATE INDEX `FraudAlert_checkInId_idx` ON `FraudAlert`(`checkInId`);

-- AddForeignKey
ALTER TABLE `PointMovement` ADD CONSTRAINT `PointMovement_checkInId_fkey` FOREIGN KEY (`checkInId`) REFERENCES `SpaceCheckIn`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PointMovement` ADD CONSTRAINT `PointMovement_spinId_fkey` FOREIGN KEY (`spinId`) REFERENCES `Spin`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StatusMovement` ADD CONSTRAINT `StatusMovement_checkInId_fkey` FOREIGN KEY (`checkInId`) REFERENCES `SpaceCheckIn`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Promotion` ADD CONSTRAINT `Promotion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FraudAlert` ADD CONSTRAINT `FraudAlert_checkInId_fkey` FOREIGN KEY (`checkInId`) REFERENCES `SpaceCheckIn`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Space` ADD CONSTRAINT `Space_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpaceCheckIn` ADD CONSTRAINT `SpaceCheckIn_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `Space`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpaceCheckIn` ADD CONSTRAINT `SpaceCheckIn_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpinPrize` ADD CONSTRAINT `SpinPrize_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpinPrize` ADD CONSTRAINT `SpinPrize_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Spin` ADD CONSTRAINT `Spin_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Spin` ADD CONSTRAINT `Spin_prizeId_fkey` FOREIGN KEY (`prizeId`) REFERENCES `SpinPrize`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Spin` ADD CONSTRAINT `Spin_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `Promotion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Spin` ADD CONSTRAINT `Spin_redemptionId_fkey` FOREIGN KEY (`redemptionId`) REFERENCES `Redemption`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Spin` ADD CONSTRAINT `Spin_unlockTransactionId_fkey` FOREIGN KEY (`unlockTransactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KycRequest` ADD CONSTRAINT `KycRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KycRequest` ADD CONSTRAINT `KycRequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KycDocument` ADD CONSTRAINT `KycDocument_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `KycRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BirthdayPerk` ADD CONSTRAINT `BirthdayPerk_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BirthdayPerk` ADD CONSTRAINT `BirthdayPerk_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BirthdayClaim` ADD CONSTRAINT `BirthdayClaim_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BirthdayClaim` ADD CONSTRAINT `BirthdayClaim_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BirthdayClaim` ADD CONSTRAINT `BirthdayClaim_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BirthdayClaim` ADD CONSTRAINT `BirthdayClaim_validatedById_fkey` FOREIGN KEY (`validatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
