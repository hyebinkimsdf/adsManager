export type AdType = "display" | "reward";
/** 토스애즈 디스플레이 광고의 4가지 캠페인 목표(구매/앱설치/잠재고객/방문)와 동일한 구조 */
export type DisplayObjective = "purchase" | "app_install" | "leads" | "visit";
export type CampaignStatus = "active" | "paused";
export type CampaignIndustry =
  | "food"
  | "beauty"
  | "education"
  | "medical"
  | "shopping"
  | "realestate"
  | "finance"
  | "it_app"
  | "etc";

export interface Targeting {
  ageRange: string;
  gender: "all" | "male" | "female";
  regions: string[];
  interests: string[];
}

export interface DayMetric {
  label: string; // "D-13" ~ "D-0"
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface Campaign {
  id: string;
  name: string;
  /** 지금은 디스플레이 광고만 지원한다. 리워드 광고(머니알림·행운퀴즈 등)는 별도 캠페인 타입으로 추가 예정. */
  adType: AdType;
  objective: DisplayObjective;
  industry: CampaignIndustry;
  status: CampaignStatus;
  dailyBudget: number;
  targeting: Targeting;
  history: DayMetric[];
}

/** 토스 픽셀/전환추적코드가 실제로 수집하는 이벤트 목록 중, 이 프로젝트에서 다루는 핵심 8종 */
export type ConversionEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "signup"
  | "lead_collection"
  | "app_install"
  | "purchase"
  | "subscribe";

export interface ConversionEvent {
  id: string;
  campaignId: string;
  eventType: ConversionEventType;
  /** 이벤트에 연결된 금액(원). 구매가 아니면 보통 0. */
  value: number;
  occurredAt: string; // ISO 8601
}

/** pixel.js가 사이트에 설치되는 순간 크롤링해서 찾아내는 클릭 가능한 요소 하나. */
export interface SiteElement {
  /** 이 요소를 다시 찾기 위한 CSS 선택자 — 최대한 안정적인 id/속성을 우선한다. */
  selector: string;
  tag: string;
  type: "form" | "button" | "link" | "input";
  /** 버튼/링크 텍스트 또는 폼의 대표 라벨. AI가 이 텍스트로 전환 종류를 추론한다. */
  text: string;
}

/** 캠페인의 사이트를 한 번 크롤링한 결과 스냅샷. 새로 스캔하면 이전 스캔을 덮어쓴다. */
export interface SiteScan {
  id: string;
  campaignId: string;
  pageUrl: string;
  elements: SiteElement[];
  scannedAt: string; // ISO 8601
}

/**
 * GTM의 "트리거+변수" 설정을 AI가 대신 만들어준 결과. pixel.js가 방문자 브라우저에서
 * 이 규칙 목록을 내려받아 selector에 트리거(click/submit)를 걸고 자동으로 이벤트를 전송한다.
 */
export interface EventRule {
  id: string;
  campaignId: string;
  selector: string;
  trigger: "click" | "submit";
  eventType: ConversionEventType;
  /** "문의하기 버튼"처럼 이 규칙이 무엇을 추적하는지 사람이 읽을 수 있는 설명. */
  label: string;
  enabled: boolean;
}

export interface CampaignTotals {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}
