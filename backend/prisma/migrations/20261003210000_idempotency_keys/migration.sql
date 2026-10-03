-- CreateTable
CREATE TABLE `IdempotencyKey` (
    `userId` INTEGER NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `endpoint` VARCHAR(100) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `response` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IdempotencyKey_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`userId`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IdempotencyKey` ADD CONSTRAINT `IdempotencyKey_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
