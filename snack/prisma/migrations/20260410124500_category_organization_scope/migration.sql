-- 카테고리를 조직 범위로 분리 (기존 행은 가장 작은 id의 조직에 귀속)

ALTER TABLE `categories` ADD COLUMN `organization_id` BIGINT NULL;

UPDATE `categories`
SET `organization_id` = (SELECT `id` FROM `organizations` ORDER BY `id` ASC LIMIT 1)
WHERE `organization_id` IS NULL;

ALTER TABLE `categories` MODIFY COLUMN `organization_id` BIGINT NOT NULL;

-- 기존 DB에 Prisma가 만든 (parent_id, name) 유니크가 있다면 수동으로 삭제한 뒤 아래 유니크를 적용하세요.
CREATE UNIQUE INDEX `categories_org_parent_name_key` ON `categories`(`organization_id`, `parent_id`, `name`);

CREATE INDEX `categories_organization_id_idx` ON `categories`(`organization_id`);

ALTER TABLE `categories`
ADD CONSTRAINT `categories_organization_id_fkey`
FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
