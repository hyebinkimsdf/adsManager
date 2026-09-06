import type { CampaignIndustry } from "../mock/types";

export type ActionType =
  | "adjust_budget"
  | "pause_campaign"
  | "resume_campaign"
  | "update_targeting"
  | "open_keyword_tool"
  | "adjust_keyword_bids"
  | "info";

export type RiskLevel = "low" | "medium" | "high";

export interface AssistantAction {
  id: string;
  type: ActionType;
  label: string;
  description: string;
  campaignId?: string;
  percent?: number;
  keywords?: string[];
  riskLevel: RiskLevel;
}

export interface AssistantReply {
  reply: string;
  actions: AssistantAction[];
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  reply?: AssistantReply;
  engineUsed?: EngineKind;
  text?: string;
  pending?: boolean;
}

export type EngineKind = "on-device" | "cloud" | "preview" | "naver-ads";

export interface CampaignSnapshot {
  id: string;
  name: string;
  status: string;
  channels: string[];
  industry: CampaignIndustry;
  dailyBudget: number;
  ctr: number;
  cpa: number;
  roas: number;
  spendTrendPercent: number;
  keywords: string[];
}

export type KeywordMatchType = "broad" | "phrase" | "exact";

export interface KeywordSuggestion {
  keyword: string;
  matchType: KeywordMatchType;
  /** 네이버 검색광고 API 실데이터일 때만 채워짐 (월간 PC+모바일 검색수) */
  monthlySearches?: number;
  /** 네이버 검색광고 API 실데이터일 때만 채워짐 (경쟁정도) */
  competition?: "low" | "medium" | "high";
  /** 네이버 검색광고 API 실데이터일 때만 채워짐 (핵심/서브 키워드 구분) */
  tier?: "core" | "sub";
}

export interface KeywordSuggestionReply {
  keywords: KeywordSuggestion[];
}
