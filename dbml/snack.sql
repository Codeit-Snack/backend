CREATE TABLE `organizations` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `org_type` ENUM ('PERSONAL', 'BUSINESS') NOT NULL DEFAULT 'BUSINESS',
  `business_number` varchar(30),
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `users` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `email` varchar(320) UNIQUE NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `is_active` boolean NOT NULL DEFAULT true,
  `last_login_at` datetime,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `user_profiles` (
  `user_id` bigint PRIMARY KEY,
  `display_name` varchar(100),
  `avatar_url` text,
  `phone` varchar(30),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `organization_members` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `role` ENUM ('MEMBER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'MEMBER',
  `joined_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `is_active` boolean NOT NULL DEFAULT true
);

CREATE TABLE `invitations` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint NOT NULL,
  `email` varchar(320) NOT NULL,
  `invitee_name` varchar(100),
  `token_hash` varchar(255) NOT NULL,
  `status` ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
  `invited_by_user_id` bigint,
  `role_to_grant` ENUM ('MEMBER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'MEMBER',
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `last_sent_at` datetime,
  `resent_count` int NOT NULL DEFAULT 0,
  `revoked_at` datetime,
  `accepted_user_id` bigint,
  `accepted_at` datetime
);

CREATE TABLE `auth_sessions` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `current_organization_id` bigint,
  `refresh_token_hash` varchar(255) NOT NULL,
  `status` ENUM ('ACTIVE', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `last_seen_at` datetime,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime,
  `ip` varchar(45),
  `user_agent` text
);

CREATE TABLE `password_reset_tokens` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `expires_at` datetime NOT NULL,
  `used_at` datetime,
  `requested_ip` varchar(45),
  `requested_user_agent` text
);

CREATE TABLE `categories` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `parent_id` bigint,
  `name` varchar(120) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `products` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint NOT NULL,
  `category_id` bigint,
  `name` varchar(200) NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `image_key` varchar(512),
  `product_url` text,
  `purchase_count_cache` int NOT NULL DEFAULT 0,
  `created_by_user_id` bigint,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `carts` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `cart_items` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `cart_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `quantity` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `purchase_requests` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `buyer_organization_id` bigint NOT NULL,
  `requester_user_id` bigint NOT NULL,
  `status` ENUM ('OPEN', 'PARTIALLY_APPROVED', 'READY_TO_PURCHASE', 'REJECTED', 'CANCELED', 'PURCHASED') NOT NULL DEFAULT 'OPEN',
  `request_message` text,
  `total_amount` decimal(14,2) NOT NULL DEFAULT 0,
  `requested_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `canceled_at` datetime,
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `purchase_request_items` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `purchase_request_id` bigint NOT NULL,
  `seller_organization_id` bigint NOT NULL,
  `product_id` bigint,
  `product_name_snapshot` varchar(200) NOT NULL,
  `product_url_snapshot` text,
  `unit_price_snapshot` decimal(12,2) NOT NULL,
  `quantity` int NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `purchase_orders` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `purchase_request_id` bigint NOT NULL,
  `buyer_organization_id` bigint NOT NULL,
  `seller_organization_id` bigint NOT NULL,
  `status` ENUM ('PENDING_SELLER_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELED', 'PURCHASED') NOT NULL DEFAULT 'PENDING_SELLER_APPROVAL',
  `platform` ENUM ('COUPANG', 'NAVER', 'MARKET_KURLY', 'SSG', 'OTHER') NOT NULL DEFAULT 'OTHER',
  `external_order_no` varchar(100),
  `order_url` text,
  `items_amount` decimal(14,2) NOT NULL DEFAULT 0,
  `shipping_fee` decimal(12,2) NOT NULL DEFAULT 0,
  `approved_at` datetime,
  `rejected_at` datetime,
  `ordered_at` datetime,
  `purchased_by_user_id` bigint,
  `shipping_status` varchar(40),
  `delivered_at` datetime,
  `note` text,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `purchase_order_items` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `purchase_order_id` bigint NOT NULL,
  `purchase_request_item_id` bigint,
  `product_id` bigint,
  `product_name_snapshot` varchar(200) NOT NULL,
  `product_url_snapshot` text,
  `unit_price_snapshot` decimal(12,2) NOT NULL,
  `quantity` int NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `purchase_order_decisions` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `purchase_order_id` bigint NOT NULL,
  `decided_by_user_id` bigint NOT NULL,
  `decision` ENUM ('APPROVED', 'REJECTED') NOT NULL,
  `decision_message` text,
  `decided_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `budget_reservations` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `buyer_organization_id` bigint NOT NULL,
  `purchase_order_id` bigint UNIQUE NOT NULL,
  `reserved_amount` decimal(14,2) NOT NULL,
  `status` ENUM ('ACTIVE', 'RELEASED', 'CONSUMED') NOT NULL DEFAULT 'ACTIVE',
  `created_by_user_id` bigint,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `released_at` datetime,
  `consumed_at` datetime
);

CREATE TABLE `expenses` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `buyer_organization_id` bigint NOT NULL,
  `purchase_order_id` bigint UNIQUE NOT NULL,
  `purchase_request_id` bigint NOT NULL,
  `items_amount` decimal(14,2) NOT NULL DEFAULT 0,
  `shipping_amount` decimal(14,2) NOT NULL DEFAULT 0,
  `amount` decimal(14,2) NOT NULL,
  `expensed_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `recorded_by_user_id` bigint,
  `note` text
);

CREATE TABLE `budget_periods` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint NOT NULL,
  `year` int NOT NULL,
  `month` int NOT NULL,
  `budget_amount` decimal(14,2) NOT NULL DEFAULT 0,
  `created_by_user_id` bigint,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE `audit_logs` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint,
  `actor_type` ENUM ('USER', 'SYSTEM') NOT NULL DEFAULT 'USER',
  `actor_user_id` bigint,
  `action` varchar(80) NOT NULL,
  `target_type` varchar(80),
  `target_id` bigint,
  `message` text,
  `metadata` json,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX `organizations_index_0` ON `organizations` (`org_type`, `name`);

CREATE INDEX `organizations_index_1` ON `organizations` (`business_number`);

CREATE INDEX `organizations_index_2` ON `organizations` (`name`);

CREATE UNIQUE INDEX `organization_members_index_3` ON `organization_members` (`organization_id`, `user_id`);

CREATE INDEX `organization_members_index_4` ON `organization_members` (`organization_id`, `role`);

CREATE INDEX `organization_members_index_5` ON `organization_members` (`user_id`);

CREATE UNIQUE INDEX `invitations_index_6` ON `invitations` (`token_hash`);

CREATE INDEX `invitations_index_7` ON `invitations` (`organization_id`, `email`);

CREATE INDEX `invitations_index_8` ON `invitations` (`organization_id`, `status`, `expires_at`);

CREATE INDEX `invitations_index_9` ON `invitations` (`status`);

CREATE INDEX `invitations_index_10` ON `invitations` (`expires_at`);

CREATE INDEX `auth_sessions_index_11` ON `auth_sessions` (`user_id`, `status`);

CREATE INDEX `auth_sessions_index_12` ON `auth_sessions` (`current_organization_id`);

CREATE INDEX `auth_sessions_index_13` ON `auth_sessions` (`user_id`, `current_organization_id`);

CREATE UNIQUE INDEX `auth_sessions_index_14` ON `auth_sessions` (`refresh_token_hash`);

CREATE INDEX `auth_sessions_index_15` ON `auth_sessions` (`expires_at`);

CREATE UNIQUE INDEX `password_reset_tokens_index_16` ON `password_reset_tokens` (`token_hash`);

CREATE INDEX `password_reset_tokens_index_17` ON `password_reset_tokens` (`user_id`, `expires_at`);

CREATE INDEX `password_reset_tokens_index_18` ON `password_reset_tokens` (`expires_at`);

CREATE UNIQUE INDEX `categories_index_19` ON `categories` (`parent_id`, `name`);

CREATE INDEX `categories_index_20` ON `categories` (`parent_id`);

CREATE INDEX `categories_index_21` ON `categories` (`name`);

CREATE INDEX `products_index_22` ON `products` (`organization_id`, `is_active`, `created_at`);

CREATE INDEX `products_index_23` ON `products` (`category_id`, `price`);

CREATE INDEX `products_index_24` ON `products` (`name`);

CREATE INDEX `products_index_25` ON `products` (`purchase_count_cache`);

CREATE UNIQUE INDEX `carts_index_26` ON `carts` (`organization_id`, `user_id`);

CREATE INDEX `carts_index_27` ON `carts` (`user_id`);

CREATE UNIQUE INDEX `cart_items_index_28` ON `cart_items` (`cart_id`, `product_id`);

CREATE INDEX `cart_items_index_29` ON `cart_items` (`product_id`);

CREATE INDEX `purchase_requests_index_30` ON `purchase_requests` (`buyer_organization_id`, `status`, `requested_at`);

CREATE INDEX `purchase_requests_index_31` ON `purchase_requests` (`buyer_organization_id`, `requester_user_id`, `requested_at`);

CREATE INDEX `purchase_requests_index_32` ON `purchase_requests` (`buyer_organization_id`, `total_amount`, `requested_at`);

CREATE INDEX `purchase_request_items_index_33` ON `purchase_request_items` (`purchase_request_id`);

CREATE INDEX `purchase_request_items_index_34` ON `purchase_request_items` (`seller_organization_id`);

CREATE INDEX `purchase_request_items_index_35` ON `purchase_request_items` (`product_id`);

CREATE INDEX `purchase_request_items_index_36` ON `purchase_request_items` (`purchase_request_id`, `seller_organization_id`);

CREATE UNIQUE INDEX `purchase_orders_index_37` ON `purchase_orders` (`purchase_request_id`, `seller_organization_id`);

CREATE INDEX `purchase_orders_index_38` ON `purchase_orders` (`buyer_organization_id`, `status`, `created_at`);

CREATE INDEX `purchase_orders_index_39` ON `purchase_orders` (`seller_organization_id`, `status`, `created_at`);

CREATE INDEX `purchase_orders_index_40` ON `purchase_orders` (`buyer_organization_id`, `ordered_at`);

CREATE INDEX `purchase_orders_index_41` ON `purchase_orders` (`seller_organization_id`, `ordered_at`);

CREATE UNIQUE INDEX `purchase_orders_index_42` ON `purchase_orders` (`platform`, `external_order_no`);

CREATE INDEX `purchase_order_items_index_43` ON `purchase_order_items` (`purchase_order_id`);

CREATE INDEX `purchase_order_items_index_44` ON `purchase_order_items` (`purchase_request_item_id`);

CREATE UNIQUE INDEX `purchase_order_items_index_45` ON `purchase_order_items` (`purchase_order_id`, `purchase_request_item_id`);

CREATE INDEX `purchase_order_items_index_46` ON `purchase_order_items` (`purchase_order_id`, `product_id`);

CREATE INDEX `purchase_order_decisions_index_47` ON `purchase_order_decisions` (`purchase_order_id`, `decided_at`);

CREATE INDEX `purchase_order_decisions_index_48` ON `purchase_order_decisions` (`decided_by_user_id`, `decided_at`);

CREATE INDEX `budget_reservations_index_49` ON `budget_reservations` (`buyer_organization_id`, `status`, `created_at`);

CREATE INDEX `budget_reservations_index_50` ON `budget_reservations` (`buyer_organization_id`, `created_at`);

CREATE INDEX `expenses_index_51` ON `expenses` (`buyer_organization_id`, `expensed_at`);

CREATE INDEX `expenses_index_52` ON `expenses` (`buyer_organization_id`, `purchase_request_id`);

CREATE INDEX `expenses_index_53` ON `expenses` (`purchase_order_id`);

CREATE UNIQUE INDEX `budget_periods_index_54` ON `budget_periods` (`organization_id`, `year`, `month`);

CREATE INDEX `audit_logs_index_55` ON `audit_logs` (`organization_id`, `created_at`);

CREATE INDEX `audit_logs_index_56` ON `audit_logs` (`actor_user_id`, `created_at`);

CREATE INDEX `audit_logs_index_57` ON `audit_logs` (`action`, `created_at`);

ALTER TABLE `user_profiles` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `organization_members` ADD FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `organization_members` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `invitations` ADD FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `invitations` ADD FOREIGN KEY (`invited_by_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `invitations` ADD FOREIGN KEY (`accepted_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `auth_sessions` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `auth_sessions` ADD FOREIGN KEY (`current_organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `password_reset_tokens` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `categories` ADD FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`);

ALTER TABLE `products` ADD FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `products` ADD FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`);

ALTER TABLE `products` ADD FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `carts` ADD FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `carts` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `cart_items` ADD FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`);

ALTER TABLE `cart_items` ADD FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

ALTER TABLE `purchase_requests` ADD FOREIGN KEY (`buyer_organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `purchase_requests` ADD FOREIGN KEY (`requester_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `purchase_request_items` ADD FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`);

ALTER TABLE `purchase_request_items` ADD FOREIGN KEY (`seller_organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `purchase_request_items` ADD FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

ALTER TABLE `purchase_orders` ADD FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`);

ALTER TABLE `purchase_orders` ADD FOREIGN KEY (`buyer_organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `purchase_orders` ADD FOREIGN KEY (`seller_organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `purchase_orders` ADD FOREIGN KEY (`purchased_by_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `purchase_order_items` ADD FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`);

ALTER TABLE `purchase_order_items` ADD FOREIGN KEY (`purchase_request_item_id`) REFERENCES `purchase_request_items` (`id`);

ALTER TABLE `purchase_order_items` ADD FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

ALTER TABLE `purchase_order_decisions` ADD FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`);

ALTER TABLE `purchase_order_decisions` ADD FOREIGN KEY (`decided_by_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `budget_reservations` ADD FOREIGN KEY (`buyer_organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `budget_reservations` ADD FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`);

ALTER TABLE `budget_reservations` ADD FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `expenses` ADD FOREIGN KEY (`buyer_organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `expenses` ADD FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`);

ALTER TABLE `expenses` ADD FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`);

ALTER TABLE `expenses` ADD FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `budget_periods` ADD FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `budget_periods` ADD FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `audit_logs` ADD FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`);

ALTER TABLE `audit_logs` ADD FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`);
