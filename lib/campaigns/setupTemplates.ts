import { addDays } from "./setupConversation";
import { MIN_RECOMMENDED_DAYS, MIN_TOTAL_BUDGET, staticBudgetRecommendation, type CampaignSetupDraft } from "./setup";

export type SetupTemplateId = "recommended" | "conversion" | "custom";

export interface SetupTemplate {
  id: SetupTemplateId;
  label: string;
  description: string;
}

export const SETUP_TEMPLATES: SetupTemplate[] = [
  { id: "recommended", label: "추천 설정", description: "목표·업종 평균으로 무난하게 시작해요." },
  { id: "conversion", label: "전환 최적화", description: "예산과 기간을 넉넉히 잡아 데이터를 더 빨리 모아요." },
  { id: "custom", label: "직접 설정", description: "최소값에서 시작해서 하나씩 정해요." },
];

const CONVERSION_TEMPLATE_DAYS = 14;
const CONVERSION_BUDGET_MULTIPLIER = 1.5;

/**
 * 카드를 누르면 예산·기간만 그 전략에 맞게 채운다. 목표·업종은 이미 사용자가 말했거나
 * 고른 값을 그대로 두고 건드리지 않는다 — 템플릿은 "얼마나·며칠"에 대한 제안이지
 * "무엇을 광고할지"에 대한 제안이 아니다.
 */
export function applySetupTemplate(
  templateId: SetupTemplateId,
  draft: CampaignSetupDraft,
  recommendedBudget: number | null,
): CampaignSetupDraft {
  if (templateId === "custom") {
    return { ...draft, totalBudget: MIN_TOTAL_BUDGET, endDate: addDays(draft.startDate, MIN_RECOMMENDED_DAYS - 1) };
  }
  if (templateId === "recommended") {
    const totalBudget = recommendedBudget ?? staticBudgetRecommendation(draft.objective, draft.industry, MIN_RECOMMENDED_DAYS);
    return { ...draft, totalBudget, endDate: addDays(draft.startDate, MIN_RECOMMENDED_DAYS - 1) };
  }
  // conversion: 실계정 벤치마크 유무와 무관하게 항상 같은 기준(기준표 × 1.5, 14일)으로 계산한다 —
  // "추천 설정"보다 확실히 더 넉넉하다는 걸 데이터 상태와 상관없이 보장하기 위함.
  const base = staticBudgetRecommendation(draft.objective, draft.industry, CONVERSION_TEMPLATE_DAYS);
  const totalBudget = Math.max(MIN_TOTAL_BUDGET, Math.round((base * CONVERSION_BUDGET_MULTIPLIER) / 100) * 100);
  return { ...draft, totalBudget, endDate: addDays(draft.startDate, CONVERSION_TEMPLATE_DAYS - 1) };
}

export function describeSetupTemplate(templateId: SetupTemplateId): string {
  if (templateId === "custom") return "최소 금액과 기본 기간으로 채웠어요. 하나씩 확인하고 바꿔 주세요.";
  if (templateId === "conversion") return "전환 데이터가 더 빨리 쌓이도록 예산과 기간을 넉넉하게 채웠어요.";
  return "목표·업종 평균으로 예산과 기간을 채웠어요.";
}
