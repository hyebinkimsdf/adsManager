-- production DB(ads-manager-db)에만 남아있던 예전 스키마의 흔적을 제거한다.
-- Campaign.channels는 NOT NULL이지만 지금 앱 코드(lib/mock/types.ts의 Campaign 타입, 모든 INSERT 문)는
-- 이 컬럼을 전혀 모른다 — 즉 지금 코드로 새 캠페인을 만들면 이 컬럼의 NOT NULL 제약 때문에 저장이
-- 실패한다. 값을 쓰는 코드가 없으므로 백업 없이 그대로 제거해도 안전하다(D1은 DROP COLUMN을 지원).
-- 적용: npm run db:apply -- d1/migrations/0002_drop_campaign_channels.sql

ALTER TABLE Campaign DROP COLUMN channels;
