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
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_conversion_event_campaign ON ConversionEvent(campaignId);
CREATE INDEX IF NOT EXISTS idx_conversion_event_occurred ON ConversionEvent(occurredAt);

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
