-- auth_sessions: 로그인 시 세션 생성에 필요. init_core 마이그레이션에 누락되어 있었음.

CREATE TABLE `auth_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `current_organization_id` BIGINT NULL,
    `refresh_token_hash` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_seen_at` DATETIME(0) NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `revoked_at` DATETIME(0) NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,

    UNIQUE INDEX `auth_sessions_index_14`(`refresh_token_hash`),
    INDEX `auth_sessions_index_11`(`user_id`, `status`),
    INDEX `auth_sessions_index_12`(`current_organization_id`),
    INDEX `auth_sessions_index_13`(`user_id`, `current_organization_id`),
    INDEX `auth_sessions_index_15`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_ibfk_2` FOREIGN KEY (`current_organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
