import type { CampaignIndustry, DisplayObjective } from "../mock/types";

export type ActionType = "adjust_budget" | "pause_campaign" | "resume_campaign" | "info";

export type RiskLevel = "low" | "medium" | "high";

export interface AssistantAction {
  id: string;
  type: ActionType;
  label: string;
  description: string;
  campaignId?: string;
  percent?: number;
  /** 사용자가 상대 비율이 아니라 정확한 금액을 말했을 때(예: "7만원으로") 쓰는 절대 목표 일 예산(원). */
  targetAmount?: number;
  riskLevel: RiskLevel;
}

export interface AssistantReply {
  reply: string;
  actions: AssistantAction[];
  /** 짧게 눌러서 답할 수 있는 다음 선택지. 대상 캠페인 등 되물어야 할 때만 채운다. */
  quickReplies?: string[];
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  reply?: AssistantReply;
  engineUsed?: EngineKind;
  text?: string;
  pending?: boolean;
}

export type EngineKind = "on-device" | "cloud" | "preview";

export interface CampaignSnapshot {
  id: string;
  name: string;
  status: string;
  objective: DisplayObjective;
  industry: CampaignIndustry;
  dailyBudget: number;
  ctr: number;
  cpa: number;
  roas: number;
  spendTrendPercent: number;
}
