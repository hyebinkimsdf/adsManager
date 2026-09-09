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
