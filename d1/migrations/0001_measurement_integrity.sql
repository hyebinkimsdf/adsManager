-- 측정 데이터 무결성 마이그레이션: 실데이터/테스트/과거 시드를 구분(source)하고,
-- 픽셀 중복 전송·재시도로 인한 이중 집계를 막기 위한 idempotency 키(eventId·orderId)를 추가한다.
-- 신규 배포는 d1/schema.sql에 이미 반영돼 있으므로 이 파일은 기존에 배포된 DB에만 적용한다.
-- 적용: npm run db:apply -- d1/migrations/0001_measurement_integrity.sql
-- (이미 production ads-manager-db에는 2026-09-10에 적용 완료됨)

ALTER TABLE ConversionEvent ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE ConversionEvent ADD COLUMN eventId TEXT;
ALTER TABLE ConversionEvent ADD COLUMN orderId TEXT;

-- 기존 행은 출처를 실측으로 확신할 수 없으므로 'legacy'로 남겨두고 live 집계에서 제외한다.
UPDATE ConversionEvent SET source = 'legacy' WHERE source IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_event_event_id ON ConversionEvent(eventId) WHERE eventId IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_event_campaign_order ON ConversionEvent(campaignId, orderId) WHERE orderId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversion_event_source ON ConversionEvent(source);

ALTER TABLE Campaign ADD COLUMN metricSource TEXT NOT NULL DEFAULT 'unverified';

-- 기존에 심어둔 데모 시드 캠페인은 이름 패턴으로 식별해 명시적으로 demo로 표시한다.
UPDATE Campaign SET metricSource = 'demo' WHERE id IN (
  'camp-purchase-shopping', 'camp-visit-newlaunch', 'camp-purchase-retarget', 'camp-appinstall-service', 'camp-leads-finance'
);
