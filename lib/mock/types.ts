export type CampaignChannel = "search" | "social" | "display" | "video";
export type CampaignObjective = "conversion" | "traffic" | "awareness" | "leads";
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
  keywords: string[];
  /** 키워드별 설정 단가(원). 네이버 검색광고 API 추천 단가를 기본값으로 사용자가 조정할 수 있음 */
  keywordBids?: Record<string, number>;
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
  channels: CampaignChannel[];
  objective: CampaignObjective;
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
