import type { DayMetric } from "@/lib/mock/types";

// "확인해 볼 광고 설정" 섹션(lib/insights.ts의 decideWeeklyRecommendations)이 실제로 캠페인의
// history 데이터에 반응하는지 눈으로 확인해보기 위한 테스트 전용 유틸 — 실제 매체 연동이 없어
// 진짜 실적을 만들 수 없으니, 원하는 최근 7일 합계(지출·전환·매출)를 그대로 재현한 history를 만든다.
export const TEST_SPEND_MAX = 100_000_000;
export const TEST_CONVERSIONS_MAX = 100_000;
export const TEST_REVENUE_MAX = 1_000_000_000;

/** 7일에 고르게 나눠 담되, 나눗셈 나머지는 마지막 날에 몰아서 합계가 입력값과 정확히 일치하게 한다. */
function spreadOverDays(total: number, days: number): number[] {
  const base = Math.floor(total / days);
  const remainder = total - base * days;
  return Array.from({ length: days }, (_, i) => (i === days - 1 ? base + remainder : base));
}

/**
 * spend/conversions/revenue 합계가 정확히 입력값과 같은 최근 7일치 DayMetric을 만든다. clicks·
 * impressions는 decideWeeklyRecommendations의 전환율 계산(0으로 나누기 방지)을 위해 합리적인
 * 값으로 함께 채운다 — conversions가 0이어도 클릭은 있을 수 있다는 가정으로 최소값을 둔다.
 */
export function buildSyntheticLast7Days(spend: number, conversions: number, revenue: number): DayMetric[] {
  const days = 7;
  const estimatedClicks = Math.max(conversions * 10, spend > 0 ? 10 : 0);
  const spends = spreadOverDays(spend, days);
  const convs = spreadOverDays(conversions, days);
  const revenues = spreadOverDays(revenue, days);
  const clicks = spreadOverDays(estimatedClicks, days);

  return Array.from({ length: days }, (_, i) => ({
    label: `TEST-D-${days - 1 - i}`,
    spend: spends[i],
    conversions: convs[i],
    revenue: revenues[i],
    clicks: clicks[i],
    impressions: clicks[i] * 15,
  }));
}

export interface TestPerformanceInput {
  spend: number;
  conversions: number;
  revenue: number;
}

export type TestPerformanceValidation = { ok: true; value: TestPerformanceInput } | { ok: false; error: string };

function isNonNegativeInt(value: number, max: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= max;
}

export function validateTestPerformanceInput(spend: number, conversions: number, revenue: number): TestPerformanceValidation {
  if (!isNonNegativeInt(spend, TEST_SPEND_MAX)) return { ok: false, error: `지출은 0~${TEST_SPEND_MAX.toLocaleString("ko-KR")} 사이의 정수여야 해요.` };
  if (!isNonNegativeInt(conversions, TEST_CONVERSIONS_MAX)) return { ok: false, error: `전환은 0~${TEST_CONVERSIONS_MAX.toLocaleString("ko-KR")} 사이의 정수여야 해요.` };
  if (!isNonNegativeInt(revenue, TEST_REVENUE_MAX)) return { ok: false, error: `매출은 0~${TEST_REVENUE_MAX.toLocaleString("ko-KR")} 사이의 정수여야 해요.` };
  return { ok: true, value: { spend, conversions, revenue } };
}

/** 기존 history에서 최근 7일만 테스트 값으로 갈아끼우고, 그 이전 기록은 추세 비교용으로 그대로 둔다. */
export function replaceLast7Days(history: DayMetric[], input: TestPerformanceInput): DayMetric[] {
  return [...history.slice(0, -7), ...buildSyntheticLast7Days(input.spend, input.conversions, input.revenue)];
}
