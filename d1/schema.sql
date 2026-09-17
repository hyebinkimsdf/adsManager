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
  -- 로그인 없이도 여러 유저 데이터를 한 DB에 섞어 두기 위한 소유자 id. 지금 사이트는 고정된
  -- 값(lib/campaigns/owner.ts의 MY_OWNER_ID) 하나만 조회한다 — 다른 값의 행은 DB엔 있어도 화면엔 안 보인다.
  ownerId TEXT NOT NULL DEFAULT 'owner-primary',
  totalBudget INTEGER,
  startDate TEXT,
  endDate TEXT,
  trackingConnectionId TEXT,
  setupStatus TEXT CHECK (setupStatus IN ('draft', 'configured')),
  createRequestId TEXT,
  setupRequestHash TEXT,
  -- dailyBudget이 바뀐 시각. 방금 조정한 캠페인을 관찰 기간(lib/insights.ts의 BUDGET_COOLDOWN_DAYS)
  -- 동안 예산 추천 후보에서 빼는 근거로 쓴다 — 없으면 적용 직후 같은 추천이 곧장 다시 뜬다.
  lastBudgetAdjustmentAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_owner ON Campaign(ownerId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_setup_request ON Campaign(ownerId, createRequestId);

-- dailyBudget이 바뀔 때마다(추천 적용/수동 수정 모두) 남기는 이력. baseline*은 변경 "직전" 최근 7일
-- 실적 스냅샷이라, 이후 실적과 비교해 이 변경이 실제로 도움이 됐는지 나중에 확인할 수 있다.
CREATE TABLE IF NOT EXISTS BudgetAdjustment (
  id TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  -- recommendation(추천 카드 적용) / manual(캠페인 상세에서 직접 수정).
  source TEXT NOT NULL CHECK (source IN ('recommendation', 'manual')),
  -- source가 recommendation일 때만 채워진다 — 어떤 추천을 적용한 결과인지.
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

-- 연결 확인을 마친 코드만 생성 카드에서 선택할 수 있다. 사이트 스캔만으로 승격하지 않는다.
CREATE TABLE IF NOT EXISTS TrackingConnection (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL,
  name TEXT NOT NULL,
  siteUrl TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'revoked')),
  verifiedAt TEXT,
  revokedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_tracking_connection_owner ON TrackingConnection(ownerId, status);

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

-- pixel.js가 설치된 사이트를 방문자 브라우저에서 직접 크롤링해 보낸 결과. 캠페인 안에서 페이지(pageUrl)마다 최신 1건씩 유지한다.
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
