export type AdType = "display" | "reward";
/** 토스애즈 디스플레이 광고의 5가지 캠페인 목표(구매/앱설치/잠재고객/방문/도달)와 동일한 구조 */
export type DisplayObjective = "purchase" | "app_install" | "leads" | "visit" | "reach";
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
  date?: string; // YYYY-MM-DD, Asia/Seoul. 날짜 없는 기존 기록은 실적 집계에서 제외한다.
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
  metricSource?: "demo" | "live" | "unverified";
  /** 설정 저장만 지원한다. 광고 매체의 실제 집행/지출 한도 적용 여부와는 별개다. */
  totalBudget?: number;
  startDate?: string;
  endDate?: string | null;
  trackingConnectionId?: string | null;
  setupStatus?: "draft" | "configured";
}

/** 토스 픽셀/전환추적코드가 실제로 수집하는 이벤트 목록 중, 이 프로젝트에서 다루는 핵심 8종 */
export type ConversionEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "signup"
  | "lead_collection"
  | "lead_intent"
  | "app_install"
  | "purchase"
  | "purchase_intent"
  | "subscribe";

export interface ConversionEvent {
  id: string;
  campaignId: string;
  eventType: ConversionEventType;
  /** 이벤트에 연결된 금액(원). 구매가 아니면 보통 0. */
  value: number;
  occurredAt: string; // ISO 8601
  source?: "live" | "test" | "legacy";
  eventId?: string | null;
  orderId?: string | null;
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

/**
 * 토스애즈 직접타겟팅의 실제 생성 방식 3가지(리타겟팅/전환추적 타겟/고객목록 타겟)를 그대로 따른다.
 * 판별 유니온이라 type 값에 따라 나머지 필드가 정해진다.
 */
export type Audience =
  | {
      id: string;
      name: string;
      type: "retargeting";
      estimatedSize: number;
      createdAt: string;
      sourceCampaignIds: string[];
      /** 이 캠페인에 "방문"만 했는지, "구매"까지 했는지로 재타겟팅 대상을 가른다. */
      action: "visit" | "purchase";
    }
  | {
      id: string;
      name: string;
      type: "conversion";
      estimatedSize: number;
      createdAt: string;
      eventType: ConversionEventType;
      lookbackDays: number;
      mode: "include" | "exclude";
    }
  | {
      id: string;
      name: string;
      type: "customer_list";
      estimatedSize: number;
      createdAt: string;
      fileName: string;
      rowCount: number;
    };

export type RewardProductType = "money_notification" | "lucky_quiz" | "button_press";
export type RewardCampaignStatus = "active" | "paused";

/**
 * 리워드 광고 대표 3종(머니알림/행운퀴즈/버튼 누르기)만 우선 지원한다 — 나머지 5종(라이브쇼핑/숏폼/
 * 두근두근1등찍기/미션류)은 이후 단계에서 필요할 때 같은 판별 유니온에 추가한다.
 */
export type RewardCampaign =
  | {
      id: string;
      name: string;
      productType: "money_notification";
      status: RewardCampaignStatus;
      variant: "basic" | "live";
      /** 최소 3만명 — 토스애즈 머니알림 일반형/라이브형 최소 타겟 규모 */
      targetSize: number;
      /** 업종·관심사 등 조건부 타겟을 추가로 쓰면 CPP가 가산된다(기본 30원, 상한 100원) */
      advancedTargeting: boolean;
      dailyBudget: number;
      createdAt: string;
    }
  | {
      id: string;
      name: string;
      productType: "lucky_quiz";
      status: RewardCampaignStatus;
      /** 100만~2000만원 — 논타겟 상품이라 혜택탭 전체 유저 대상 */
      totalBudget: number;
      createdAt: string;
    }
  | {
      id: string;
      name: string;
      productType: "button_press";
      status: RewardCampaignStatus;
      creativeType: "button" | "catalog";
      landingUrl: string;
      dailyBudget: number;
      createdAt: string;
    };

/** AI 사전 심사를 거쳐 저장된 배너 소재. precheck 스냅샷을 그대로 들고 있어 저장 시점의 결과를 보존한다. */
export interface Creative {
  id: string;
  campaignId: string;
  campaignName: string;
  headline: string;
  body: string;
  imageWidth?: number;
  imageHeight?: number;
  landingUrl: string;
  precheckScore: number;
  precheckItems: { id: string; category: "copy" | "image" | "landing"; label: string; status: "pass" | "warn" | "fail"; detail: string }[];
  createdAt: string;
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
