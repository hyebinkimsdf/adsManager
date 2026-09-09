import type { CampaignIndustry, DisplayObjective } from "@/lib/mock/types";

const OBJECTIVES: DisplayObjective[] = ["purchase", "app_install", "leads", "visit"];
const INDUSTRIES: CampaignIndustry[] = [
  "food",
  "beauty",
  "education",
  "medical",
  "shopping",
  "realestate",
  "finance",
  "it_app",
  "etc",
];

export const CAMPAIGN_DRAFT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["objective", "industry", "dailyBudget", "name", "reasoning"],
  properties: {
    objective: { type: "string", enum: OBJECTIVES, description: "설명에 가장 맞는 캠페인 목표" },
    industry: { type: "string", enum: INDUSTRIES, description: "설명에 가장 맞는 업종. 애매하면 etc" },
    dailyBudget: { type: "number", description: "하루 예산(원). 10000~1000000 사이 정수" },
    name: { type: "string", description: "캠페인 이름, 15자 이내 한국어" },
    reasoning: { type: "string", description: "이 설정을 추천하는 이유, 한국어로 1~2문장" },
  },
} as const;

export const CAMPAIGN_DRAFT_RESPONSE_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["objective", "industry", "dailyBudget", "name", "reasoning"],
  properties: {
    objective: { type: "string", enum: OBJECTIVES, description: "The campaign objective that best fits the description" },
    industry: { type: "string", enum: INDUSTRIES, description: "The industry that best fits the description. Use etc if unclear" },
    dailyBudget: { type: "number", description: "Daily budget in KRW. An integer between 10000 and 1000000" },
    name: { type: "string", description: "A short campaign name in English, a few words" },
    reasoning: { type: "string", description: "1-2 sentences in English explaining why this setup was recommended" },
  },
} as const;

export interface CampaignDraftSuggestion {
  objective: DisplayObjective;
  industry: CampaignIndustry;
  dailyBudget: number;
  name: string;
  reasoning: string;
}

export function isCampaignDraftSuggestion(value: unknown): value is CampaignDraftSuggestion {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.objective === "string" &&
    OBJECTIVES.includes(v.objective as DisplayObjective) &&
    typeof v.industry === "string" &&
    INDUSTRIES.includes(v.industry as CampaignIndustry) &&
    typeof v.dailyBudget === "number" &&
    Number.isFinite(v.dailyBudget) &&
    typeof v.name === "string" &&
    typeof v.reasoning === "string"
  );
}
