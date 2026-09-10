CREATE TABLE IF NOT EXISTS Campaign (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adType TEXT NOT NULL DEFAULT 'display',
  objective TEXT NOT NULL,
  industry TEXT NOT NULL,
  status TEXT NOT NULL,
  dailyBudget INTEGER NOT NULL,
  targeting TEXT NOT NULL,  -- JSON 객체로 저장
  history TEXT NOT NULL,    -- JSON 배열로 저장
  -- demo(시드) / live(실제 매체 연동 확인) / unverified(사용자가 만들었지만 아직 실적 연동 전).
  -- 화면·AI가 "실데이터"로 표시해도 되는지 판단하는 근거이며, 기본값은 안전한 쪽인 unverified.
  metricSource TEXT NOT NULL DEFAULT 'unverified',
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 토스 픽셀 스타일 전환 추적(AdsAI.track())이 수집하는 이벤트. 캠페인당 여러 건 쌓인다.
CREATE TABLE IF NOT EXISTS ConversionEvent (
  id TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  eventType TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  occurredAt TEXT NOT NULL,
  -- live(pixel.js 실제 수집) / test(관리자 화면의 테스트 전송) / legacy(source 도입 이전 시드·과거 데이터).
  -- 집계·추천 로직은 live만 사실로 취급한다.
  source TEXT NOT NULL DEFAULT 'legacy',
  -- 클라이언트가 재전송/재시도해도 같은 행동을 두 번 세지 않기 위한 멱등키(선택).
  eventId TEXT,
  -- 결제 완료 이벤트의 이중 집계를 막기 위한 주문 단위 멱등키(선택).
  orderId TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_conversion_event_campaign ON ConversionEvent(campaignId);
CREATE INDEX IF NOT EXISTS idx_conversion_event_occurred ON ConversionEvent(occurredAt);
CREATE INDEX IF NOT EXISTS idx_conversion_event_source ON ConversionEvent(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_event_event_id ON ConversionEvent(eventId) WHERE eventId IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_event_campaign_order ON ConversionEvent(campaignId, orderId) WHERE orderId IS NOT NULL;

-- pixel.js가 설치된 사이트를 방문자 브라우저에서 직접 크롤링해 보낸 결과. 캠페인당 최신 1건만 유지한다.
CREATE TABLE IF NOT EXISTS SiteScan (
  id TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  pageUrl TEXT NOT NULL,
  elements TEXT NOT NULL, -- JSON 배열: SiteElement[]
  scannedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_site_scan_campaign ON SiteScan(campaignId);

-- AI가 SiteScan을 분석해 제안하고 관리자가 승인한 자동 추적 규칙(GTM의 트리거+변수에 해당).
-- pixel.js가 방문자 브라우저에서 이 규칙을 내려받아 selector에 트리거를 걸어준다.
CREATE TABLE IF NOT EXISTS EventRule (
  id TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  selector TEXT NOT NULL,
  trigger TEXT NOT NULL, -- 'click' | 'submit'
  eventType TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_event_rule_campaign ON EventRule(campaignId);

-- 저장된 타겟(리타겟팅/전환추적 타겟/고객목록 타겟). type별 나머지 필드는 config에 JSON으로 저장한다.
CREATE TABLE IF NOT EXISTS Audience (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  estimatedSize INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 리워드 광고(머니알림/행운퀴즈/버튼 누르기). productType별 나머지 필드는 config에 JSON으로 저장한다.
CREATE TABLE IF NOT EXISTS RewardCampaign (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  productType TEXT NOT NULL,
  status TEXT NOT NULL,
  config TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- AI 사전 심사를 거쳐 저장된 배너 소재. precheckItems는 저장 시점 결과 스냅샷을 JSON으로 보존한다.
CREATE TABLE IF NOT EXISTS Creative (
  id TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  campaignName TEXT NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  imageWidth INTEGER,
  imageHeight INTEGER,
  landingUrl TEXT NOT NULL,
  precheckScore INTEGER NOT NULL,
  precheckItems TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
