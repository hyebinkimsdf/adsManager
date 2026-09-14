-- 여러 유저 데이터를 한 DB에 섞어 넣기 위한 소유자 컬럼. 로그인 기능은 아직 없어서 지금 사이트는
-- 고정된 소유자 id(lib/campaigns/owner.ts의 MY_OWNER_ID = 'owner-primary') 하나만 조회/수정하고,
-- 그 외 유저 데이터는 DB에는 존재하지만 이 사이트 화면에는 노출되지 않는다.
-- DEFAULT가 상수라 ALTER TABLE 한 번으로 기존 행 전부(지금까지의 모든 캠페인)가 'owner-primary'로
-- 채워진다 — 즉 지금 사이트가 보여주던 캠페인은 전부 그대로 "내 계정" 소유가 된다.
-- 적용: npm run db:apply -- d1/migrations/0003_add_campaign_owner_id.sql

ALTER TABLE Campaign ADD COLUMN ownerId TEXT NOT NULL DEFAULT 'owner-primary';
CREATE INDEX IF NOT EXISTS idx_campaign_owner ON Campaign(ownerId);
