-- Backfill domain tables that exist in schema.prisma but were missing in migrations.
-- Safety-first: CREATE TABLE IF NOT EXISTS prevents failure on environments where
-- these tables were already created manually.

CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT NULL,
    `actor_type` ENUM('USER', 'SYSTEM') NOT NULL DEFAULT 'USER',
    `actor_user_id` BIGINT NULL,
    `action` VARCHAR(80) NOT NULL,
    `target_type` VARCHAR(80) NULL,
    `target_id` BIGINT NULL,
    `message` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `audit_logs_index_55`(`organization_id`, `created_at`),
    INDEX `audit_logs_index_56`(`actor_user_id`, `created_at`),
    INDEX `audit_logs_index_57`(`action`, `created_at`),
    CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `audit_logs_ibfk_2` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME(0) NOT NULL,
    `used_at` DATETIME(0) NULL,
    `requested_ip` VARCHAR(45) NULL,
    `requested_user_agent` TEXT NULL,

    UNIQUE INDEX `password_reset_tokens_index_16`(`token_hash`),
    INDEX `password_reset_tokens_index_17`(`user_id`, `expires_at`),
    INDEX `password_reset_tokens_index_18`(`expires_at`),
    CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_periods` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `budget_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `created_by_user_id` BIGINT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE INDEX `budget_periods_index_54`(`organization_id`, `year`, `month`),
    INDEX `created_by_user_id`(`created_by_user_id`),
    CONSTRAINT `budget_periods_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `budget_periods_ibfk_2` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_request_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `purchase_request_id` BIGINT NOT NULL,
    `seller_organization_id` BIGINT NOT NULL,
    `product_id` BIGINT NULL,
    `product_name_snapshot` VARCHAR(200) NOT NULL,
    `product_url_snapshot` TEXT NULL,
    `unit_price_snapshot` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `line_total` DECIMAL(14, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `purchase_request_items_index_33`(`purchase_request_id`),
    INDEX `purchase_request_items_index_34`(`seller_organization_id`),
    INDEX `purchase_request_items_index_35`(`product_id`),
    INDEX `purchase_request_items_index_36`(`purchase_request_id`, `seller_organization_id`),
    CONSTRAINT `purchase_request_items_ibfk_1` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `purchase_request_items_ibfk_2` FOREIGN KEY (`seller_organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `purchase_request_items_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_orders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `purchase_request_id` BIGINT NOT NULL,
    `buyer_organization_id` BIGINT NOT NULL,
    `seller_organization_id` BIGINT NOT NULL,
    `status` ENUM('PENDING_SELLER_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELED', 'PURCHASED') NOT NULL DEFAULT 'PENDING_SELLER_APPROVAL',
    `platform` ENUM('COUPANG', 'NAVER', 'MARKET_KURLY', 'SSG', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `external_order_no` VARCHAR(100) NULL,
    `order_url` TEXT NULL,
    `items_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `shipping_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `approved_at` DATETIME(0) NULL,
    `rejected_at` DATETIME(0) NULL,
    `ordered_at` DATETIME(0) NULL,
    `purchased_by_user_id` BIGINT NULL,
    `shipping_status` VARCHAR(40) NULL,
    `delivered_at` DATETIME(0) NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE INDEX `purchase_orders_index_37`(`purchase_request_id`, `seller_organization_id`),
    UNIQUE INDEX `purchase_orders_index_42`(`platform`, `external_order_no`),
    INDEX `purchase_orders_index_38`(`buyer_organization_id`, `status`, `created_at`),
    INDEX `purchase_orders_index_39`(`seller_organization_id`, `status`, `created_at`),
    INDEX `purchase_orders_index_40`(`buyer_organization_id`, `ordered_at`),
    INDEX `purchase_orders_index_41`(`seller_organization_id`, `ordered_at`),
    INDEX `purchased_by_user_id`(`purchased_by_user_id`),
    CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `purchase_orders_ibfk_2` FOREIGN KEY (`buyer_organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `purchase_orders_ibfk_3` FOREIGN KEY (`seller_organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `purchase_orders_ibfk_4` FOREIGN KEY (`purchased_by_user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_order_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `purchase_order_id` BIGINT NOT NULL,
    `purchase_request_item_id` BIGINT NULL,
    `product_id` BIGINT NULL,
    `product_name_snapshot` VARCHAR(200) NOT NULL,
    `product_url_snapshot` TEXT NULL,
    `unit_price_snapshot` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `line_total` DECIMAL(14, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE INDEX `purchase_order_items_index_45`(`purchase_order_id`, `purchase_request_item_id`),
    INDEX `purchase_order_items_index_43`(`purchase_order_id`),
    INDEX `purchase_order_items_index_44`(`purchase_request_item_id`),
    INDEX `purchase_order_items_index_46`(`purchase_order_id`, `product_id`),
    INDEX `product_id`(`product_id`),
    CONSTRAINT `purchase_order_items_ibfk_1` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `purchase_order_items_ibfk_2` FOREIGN KEY (`purchase_request_item_id`) REFERENCES `purchase_request_items`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `purchase_order_items_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_order_decisions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `purchase_order_id` BIGINT NOT NULL,
    `decided_by_user_id` BIGINT NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `decision_message` TEXT NULL,
    `decided_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `purchase_order_decisions_index_47`(`purchase_order_id`, `decided_at`),
    INDEX `purchase_order_decisions_index_48`(`decided_by_user_id`, `decided_at`),
    CONSTRAINT `purchase_order_decisions_ibfk_1` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `purchase_order_decisions_ibfk_2` FOREIGN KEY (`decided_by_user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_reservations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `buyer_organization_id` BIGINT NOT NULL,
    `purchase_order_id` BIGINT NOT NULL,
    `reserved_amount` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('ACTIVE', 'RELEASED', 'CONSUMED') NOT NULL DEFAULT 'ACTIVE',
    `created_by_user_id` BIGINT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `released_at` DATETIME(0) NULL,
    `consumed_at` DATETIME(0) NULL,

    UNIQUE INDEX `purchase_order_id`(`purchase_order_id`),
    INDEX `budget_reservations_index_49`(`buyer_organization_id`, `status`, `created_at`),
    INDEX `budget_reservations_index_50`(`buyer_organization_id`, `created_at`),
    INDEX `created_by_user_id`(`created_by_user_id`),
    CONSTRAINT `budget_reservations_ibfk_1` FOREIGN KEY (`buyer_organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `budget_reservations_ibfk_2` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `budget_reservations_ibfk_3` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `buyer_organization_id` BIGINT NOT NULL,
    `purchase_order_id` BIGINT NOT NULL,
    `purchase_request_id` BIGINT NOT NULL,
    `items_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `shipping_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(14, 2) NOT NULL,
    `expensed_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `recorded_by_user_id` BIGINT NULL,
    `note` TEXT NULL,

    UNIQUE INDEX `purchase_order_id`(`purchase_order_id`),
    INDEX `expenses_index_51`(`buyer_organization_id`, `expensed_at`),
    INDEX `expenses_index_52`(`buyer_organization_id`, `purchase_request_id`),
    INDEX `expenses_index_53`(`purchase_order_id`),
    INDEX `purchase_request_id`(`purchase_request_id`),
    INDEX `recorded_by_user_id`(`recorded_by_user_id`),
    CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`buyer_organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `expenses_ibfk_3` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `expenses_ibfk_4` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
