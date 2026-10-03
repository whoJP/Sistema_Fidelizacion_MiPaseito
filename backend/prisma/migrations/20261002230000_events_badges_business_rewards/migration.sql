-- Rewards now belong to exactly one business and use structured fields instead of a free-text name.
ALTER TABLE `Reward`
    ADD COLUMN `businessId` INTEGER NULL,
    ADD COLUMN `type` ENUM('PERCENT_DISCOUNT', 'AMOUNT_DISCOUNT', 'FREE_PRODUCT') NOT NULL DEFAULT 'FREE_PRODUCT',
    ADD COLUMN `discountPercent` INTEGER NULL,
    ADD COLUMN `discountAmount` DECIMAL(10, 2) NULL,
    ADD COLUMN `catalogItemId` INTEGER NULL,
    ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `minimumPurchase` DECIMAL(10, 2) NULL;

-- Existing rows: keep the old name as conditions and assign the first linked business (or one of the linked category).
UPDATE `Reward` SET `description` = IF(`description` IS NULL OR `description` = '', `name`, CONCAT(`name`, ' — ', `description`));

UPDATE `Reward` r SET r.`businessId` = (SELECT MIN(rb.`businessId`) FROM `RewardBusiness` rb WHERE rb.`rewardId` = r.`id`);

UPDATE `Reward` r SET r.`businessId` = (
    SELECT MIN(bc.`businessId`) FROM `RewardCategory` rc
    JOIN `Category` c ON c.`id` = rc.`categoryId`
    JOIN `BusinessCategory` bc ON bc.`categoryId` = c.`id` OR bc.`categoryId` IN (SELECT ch.`id` FROM `Category` ch WHERE ch.`parentId` = c.`id`)
    WHERE rc.`rewardId` = r.`id`
) WHERE r.`businessId` IS NULL;

UPDATE `Reward` SET `businessId` = (SELECT MIN(`id`) FROM `Business`) WHERE `businessId` IS NULL;

ALTER TABLE `Reward`
    DROP COLUMN `name`,
    MODIFY `businessId` INTEGER NOT NULL,
    ALTER COLUMN `type` DROP DEFAULT;

ALTER TABLE `RewardBusiness` DROP FOREIGN KEY `RewardBusiness_businessId_fkey`;
ALTER TABLE `RewardBusiness` DROP FOREIGN KEY `RewardBusiness_rewardId_fkey`;
ALTER TABLE `RewardCategory` DROP FOREIGN KEY `RewardCategory_categoryId_fkey`;
ALTER TABLE `RewardCategory` DROP FOREIGN KEY `RewardCategory_rewardId_fkey`;
DROP TABLE `RewardBusiness`;
DROP TABLE `RewardCategory`;

CREATE INDEX `Reward_businessId_idx` ON `Reward`(`businessId`);
CREATE INDEX `Reward_catalogItemId_idx` ON `Reward`(`catalogItemId`);
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Events
CREATE TABLE `Event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `location` VARCHAR(150) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `pointsReward` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'DRAFT',
    `createdById` INTEGER NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Event_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EventAttendance` (
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `checkedInById` INTEGER NOT NULL,
    `checkedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventAttendance_userId_idx`(`userId`),
    INDEX `EventAttendance_checkedInById_idx`(`checkedInById`),
    PRIMARY KEY (`eventId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Event` ADD CONSTRAINT `Event_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_checkedInById_fkey` FOREIGN KEY (`checkedInById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Points granted for attending an event
ALTER TABLE `PointMovement` ADD COLUMN `eventId` INTEGER NULL,
    MODIFY `type` ENUM('PURCHASE', 'MISSION', 'PROMOTION', 'EVENT', 'REDEMPTION', 'ADJUSTMENT', 'REVERSAL') NOT NULL;
CREATE INDEX `PointMovement_eventId_idx` ON `PointMovement`(`eventId`);
ALTER TABLE `PointMovement` ADD CONSTRAINT `PointMovement_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Badges (achievements)
CREATE TABLE `Badge` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('TIER_REACHED', 'PURCHASE_COUNT', 'CATEGORY_PURCHASES', 'DISTINCT_BUSINESSES', 'MISSIONS_COMPLETED', 'SPECIAL_DATE') NOT NULL,
    `goal` INTEGER NULL,
    `tierId` INTEGER NULL,
    `categoryId` INTEGER NULL,
    `date` DATE NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdById` INTEGER NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Badge_tierId_idx`(`tierId`),
    INDEX `Badge_categoryId_idx`(`categoryId`),
    INDEX `Badge_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Badge` ADD CONSTRAINT `Badge_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `Tier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Badge` ADD CONSTRAINT `Badge_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Badge` ADD CONSTRAINT `Badge_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
