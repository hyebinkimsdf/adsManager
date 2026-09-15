import { SYSTEM_PROMPT_EN } from "./systemPrompt";
import { TRACKING_RULES_SYSTEM_PROMPT_EN } from "./trackingRulesPrompt";
import { BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN } from "./budgetRecommendationPrompt";

export const ON_DEVICE_AI_PROMPTS = [
  SYSTEM_PROMPT_EN,
  TRACKING_RULES_SYSTEM_PROMPT_EN,
  BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN,
] as const;
