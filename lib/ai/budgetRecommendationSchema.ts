export const BUDGET_RECOMMENDATION_RESPONSE_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["reasoning"],
  properties: {
    reasoning: { type: "string", description: "1-2 short sentences explaining the recommended budget, in English" },
  },
} as const;

export interface BudgetRecommendationReply {
  reasoning: string;
}

export function isBudgetRecommendationReply(value: unknown): value is BudgetRecommendationReply {
  return !!value && typeof value === "object" && typeof (value as Record<string, unknown>).reasoning === "string";
}
