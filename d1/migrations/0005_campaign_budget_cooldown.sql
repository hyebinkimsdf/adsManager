-- 예산 추천을 적용한 직후 같은 캠페인에 같은 추천(예산 줄이세요/늘리세요)이 곧바로 다시 뜨는 문제를
-- 막기 위한 컬럼. history가 하루 단위로만 갱신돼서, 예산을 바꾼 당일에는 아직 바뀌기 전 실적으로
-- 최근 7일 ROAS가 계산된다 — 관찰 기간 없이 곧장 재평가하면 방금 적용한 추천이 그대로 반복된다.
-- 적용: npm run db:apply -- d1/migrations/0005_campaign_budget_cooldown.sql

ALTER TABLE Campaign ADD COLUMN lastBudgetAdjustmentAt TEXT;
