-- 조직별 "매달 시작 예산" 기본값. 월별 행 최초 조회 시 이 금액으로 budget_periods 자동 생성(B).

ALTER TABLE `organizations`
    ADD COLUMN `default_monthly_budget` DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER `business_number`;
