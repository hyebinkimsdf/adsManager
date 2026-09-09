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
