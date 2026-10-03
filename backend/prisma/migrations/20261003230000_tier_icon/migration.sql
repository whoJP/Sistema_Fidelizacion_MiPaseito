-- AlterTable
ALTER TABLE `Tier` ADD COLUMN `icon` VARCHAR(30) NOT NULL DEFAULT 'medal';

-- Backfill: each default level gets its own icon
UPDATE `Tier` SET `icon` = 'shield' WHERE `name` = 'Bronce';
UPDATE `Tier` SET `icon` = 'star' WHERE `name` = 'Plata';
UPDATE `Tier` SET `icon` = 'crown' WHERE `name` = 'Oro';
UPDATE `Tier` SET `icon` = 'gem' WHERE `name` IN ('Platinum', 'Platino');
