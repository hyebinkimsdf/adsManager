-- 예산이 바뀔 때마다(추천 적용/수동 수정) 이력을 남겨, 나중에 "이 변경이 도움이 됐는지" 확인할 수
-- 있게 한다. baseline*은 변경 직전 최근 7일 실적 스냅샷 — 이후 실적과 비교하는 기준값이다.
-- 적용: npm run db:apply -- d1/migrations/0006_budget_adjustment_log.sql

CREATE TABLE IF NOT EXISTS BudgetAdjustment (
  id TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('recommendation', 'manual')),
  reasonKind TEXT CHECK (reasonKind IN ('lower_budget', 'raise_budget')),
  previousBudget INTEGER NOT NULL,
  newBudget INTEGER NOT NULL,
  percent REAL,
  baselineSpend INTEGER NOT NULL,
  baselineConversions INTEGER NOT NULL,
  baselineRoas REAL NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_budget_adjustment_campaign ON BudgetAdjustment(campaignId, createdAt);
