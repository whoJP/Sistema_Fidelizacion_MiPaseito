-- Store staff get their own account type (MERCHANT) and belong to a single business.
ALTER TABLE `User` MODIFY `role` ENUM('CUSTOMER', 'MERCHANT', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER';

-- Keep one membership per user: the active one first, then the manager role, then the oldest.
DELETE m FROM `BusinessMember` m
JOIN `BusinessMember` k ON k.`userId` = m.`userId` AND k.`id` <> m.`id` AND (
    (k.`status` = 'ACTIVE' AND m.`status` = 'INACTIVE')
    OR (k.`status` = m.`status` AND k.`role` = 'MANAGER' AND m.`role` = 'STAFF')
    OR (k.`status` = m.`status` AND k.`role` = m.`role` AND k.`id` < m.`id`)
);

UPDATE `User` SET `role` = 'MERCHANT' WHERE `role` = 'CUSTOMER' AND `id` IN (SELECT `userId` FROM `BusinessMember`);

CREATE UNIQUE INDEX `BusinessMember_userId_key` ON `BusinessMember`(`userId`);
DROP INDEX `BusinessMember_userId_businessId_key` ON `BusinessMember`;
