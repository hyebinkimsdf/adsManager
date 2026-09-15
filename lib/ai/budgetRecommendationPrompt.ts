import type { BudgetRecommendationFacts } from "@/lib/campaigns/budgetRecommendation";

// 얼마를 추천할지는 lib/campaigns/budgetRecommendation.ts의 코드가 이미 정했다. 이 프롬프트는
// 그 결정을 설명하는 문장만 쓰게 한다 — "코드 = 판단, AI = 설명" 원칙을 그대로 따른다.
export const BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN = `You are an ad operations assistant. A daily budget change has ALREADY been decided by the app's own rules — a specific new number within a range the advertiser confirmed. Your only job is to explain that decision in plain language.

Rules:
1. Respond ONLY in the given JSON schema format. Do not add any text outside the schema.
2. Never propose a different number. The recommended budget is fixed; you only explain why it makes sense.
3. Explain the actual budget rule: baseline is the current budget clamped into the confirmed range. With no eligible peers, retain that baseline exactly. With peers, move halfway toward their median daily budget, capped within 20% of baseline and inside the confirmed range. Never claim a range midpoint was used.
4. ROAS is only an eligibility/reference metric, never the reason for increasing or decreasing the budget. Never infer relative performance from the change direction. Unknown own ROAS is not zero. Do not promise safety, profitability, or improved performance.
5. Keep it to 1-2 short, friendly sentences. No jargon.`;

export function buildBudgetRecommendationUserTurnEn(facts: BudgetRecommendationFacts): string {
  return `[Campaign] objective=${facts.objective} industry=${facts.industry} currentDailyBudget=${facts.currentBudget} ownRoas=${facts.ownRoas === null ? "unknown" : facts.ownRoas.toFixed(1)}
[Confirmed budget range] ${facts.range.min} ~ ${facts.range.max} KRW/day
[Baseline budget] ${facts.baselineBudget} KRW/day (current budget clamped into confirmed range)
[Comparable campaigns] count=${facts.comparableCount}${
    facts.comparableAvgRoas !== null ? ` avgRoas=${facts.comparableAvgRoas.toFixed(1)}` : " (none available)"
  } medianDailyBudget=${facts.comparableMedianBudget ?? "unavailable"}
[Decided recommendation] ${facts.recommendedBudget} KRW/day (direction: ${facts.direction})`;
}
