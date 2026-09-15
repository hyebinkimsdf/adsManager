import type { IconType } from "react-icons";
import { HiOutlineArrowTrendingDown, HiOutlineArrowTrendingUp, HiOutlineBanknotes } from "react-icons/hi2";
import { MIN_DAILY_BUDGET, MAX_DAILY_BUDGET } from "./validate";

export interface BudgetTier {
  daily: number;
  label: string;
  note: string;
  icon: IconType;
  bg: string;
  color: string;
}

/** 새 캠페인 만들기와 예산 변경 추천이 공유하는 예산 규모 3단계. */
export const BUDGET_TIERS: BudgetTier[] = [
  { daily: 30000, label: "적게 사용", note: "노출이 적어서 광고 효과가 약할 수 있어요", icon: HiOutlineArrowTrendingDown, bg: "var(--color-gray-100)", color: "var(--color-gray-600)" },
  { daily: 100000, label: "보통", note: "무난하게 효과를 볼 수 있는 금액이에요", icon: HiOutlineBanknotes, bg: "var(--color-blue-50)", color: "var(--color-blue-600)" },
  { daily: 200000, label: "많이 사용", note: "더 많이 노출되지만 비용 부담이 커요", icon: HiOutlineArrowTrendingUp, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
];

/** 캠페인의 일 예산이 세 단계 중 어디에 가장 가까운지 찾는다 — 직접 입력한 금액도 이걸로 단계를 추정한다. */
export function nearestBudgetTier(dailyBudget: number): BudgetTier {
  return BUDGET_TIERS.reduce((closest, tier) =>
    Math.abs(tier.daily - dailyBudget) < Math.abs(closest.daily - dailyBudget) ? tier : closest
  );
}

/**
 * 선택한 단계가 대표하는 실제 예산 범위. 인접한 두 단계의 중간값을 경계로 삼아 전체 유효 범위
 * (MIN_DAILY_BUDGET~MAX_DAILY_BUDGET)를 세 구간으로 나눈다 — 구간마다 정확히 하나의 단계가 대응한다.
 */
export function budgetRangeForTier(daily: number): { min: number; max: number } {
  const index = BUDGET_TIERS.findIndex((tier) => tier.daily === daily);
  if (index === -1) return { min: MIN_DAILY_BUDGET, max: MAX_DAILY_BUDGET };
  const min = index === 0 ? MIN_DAILY_BUDGET : Math.floor((BUDGET_TIERS[index - 1].daily + daily) / 2) + 1;
  const max = index === BUDGET_TIERS.length - 1 ? MAX_DAILY_BUDGET : Math.floor((daily + BUDGET_TIERS[index + 1].daily) / 2);
  return { min, max };
}
