-- AlterTable
ALTER TABLE `BirthdayClaim` ADD COLUMN `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateIndex (before dropping the primary key, which was the index of the businessId foreign key)
CREATE INDEX `BirthdayPerk_businessId_idx` ON `BirthdayPerk`(`businessId`);

-- AlterTable: several birthday benefits per business
ALTER TABLE `BirthdayPerk` DROP PRIMARY KEY,
    ADD COLUMN `discountScope` ENUM('ALL', 'PRODUCT', 'CATEGORY') NULL,
    ADD COLUMN `giftCondition` ENUM('MIN_PURCHASE', 'PRODUCT') NULL,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `minimumPurchase` DECIMAL(10, 2) NULL,
    ADD COLUMN `requiredItemId` INTEGER NULL,
    ADD COLUMN `targetCategory` VARCHAR(80) NULL,
    ADD COLUMN `targetItemId` INTEGER NULL,
    ADD PRIMARY KEY (`id`);

-- Backfill: gifts ask for a purchase worth at least the gift; discounts apply to the whole purchase
UPDATE `BirthdayPerk` p
JOIN `CatalogItem` c ON c.`id` = p.`catalogItemId`
SET p.`giftCondition` = 'MIN_PURCHASE', p.`minimumPurchase` = c.`price`
WHERE p.`type` = 'FREE_PRODUCT';
UPDATE `BirthdayPerk` SET `discountScope` = 'ALL' WHERE `type` IN ('PERCENT_DISCOUNT', 'AMOUNT_DISCOUNT');

-- AlterTable
ALTER TABLE `CatalogItem` ADD COLUMN `category` VARCHAR(80) NULL;

-- AlterTable
ALTER TABLE `Redemption` ADD COLUMN `cancelReason` TEXT NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancelledById` INTEGER NULL,
    ADD COLUMN `discount` DECIMAL(10, 2) NULL,
    ADD COLUMN `transactionId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `BirthdayPerk_requiredItemId_idx` ON `BirthdayPerk`(`requiredItemId`);

-- CreateIndex
CREATE INDEX `BirthdayPerk_targetItemId_idx` ON `BirthdayPerk`(`targetItemId`);

-- CreateIndex
CREATE INDEX `Redemption_transactionId_idx` ON `Redemption`(`transactionId`);

-- CreateIndex
CREATE INDEX `Redemption_cancelledById_idx` ON `Redemption`(`cancelledById`);

-- AddForeignKey
ALTER TABLE `Redemption` ADD CONSTRAINT `Redemption_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Redemption` ADD CONSTRAINT `Redemption_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BirthdayPerk` ADD CONSTRAINT `BirthdayPerk_requiredItemId_fkey` FOREIGN KEY (`requiredItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BirthdayPerk` ADD CONSTRAINT `BirthdayPerk_targetItemId_fkey` FOREIGN KEY (`targetItemId`) REFERENCES `CatalogItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Canjes now stay on the customer's card for days, not minutes
DELETE FROM `SystemSetting` WHERE `key` = 'REDEMPTION_EXPIRATION_MINUTES';
