import { ROAS_GOOD_THRESHOLD, ROAS_OKAY_THRESHOLD } from "@/lib/insights";
import { formatKRW } from "@/lib/format";

export type MetricTone = "good" | "okay" | "bad" | "neutral";

export interface MetricExplanation {
  /** 광고 용어를 몰라도 이해할 수 있는 한 문장 — 숫자 옆에 항상 보여준다. */
  caption: string;
  tone: MetricTone;
}

/** 총 지출은 그 자체로 좋고 나쁨이 없는 사실이라, 색은 항상 중립으로 둔다. */
export function explainSpend(): MetricExplanation {
  return { caption: "최근 14일 동안 사용한 광고비예요.", tone: "neutral" };
}

/** buildRoasBuckets(이번 주 추천 카드)와 같은 기준을 재사용해, 화면마다 "좋다"의 기준이 다르지 않게 한다. */
export function explainRoas(roas: number, spend: number): MetricExplanation {
  if (spend <= 0) return { caption: "아직 지출이 없어서 계산할 수 없어요.", tone: "neutral" };
  const multiple = (roas / 100).toFixed(1);
  if (roas >= ROAS_GOOD_THRESHOLD) return { caption: `쓴 돈보다 ${multiple}배 더 벌었어요. 성과가 좋아요.`, tone: "good" };
  if (roas >= ROAS_OKAY_THRESHOLD) return { caption: `쓴 돈의 ${multiple}배를 벌었어요. 무난한 성과예요.`, tone: "okay" };
  return { caption: `쓴 돈의 ${multiple}배밖에 못 벌었어요. 예산을 줄이거나 설정을 점검해보세요.`, tone: "bad" };
}

// 이 앱에 축적된 자체 벤치마크가 없어 업계에서 흔히 쓰는 대략적인 기준을 썼다 — 정밀한 값은 아니다.
const CTR_GOOD_THRESHOLD = 1;
const CTR_OKAY_THRESHOLD = 0.3;

export function explainCtr(ctr: number, impressions: number): MetricExplanation {
  if (impressions <= 0) return { caption: "아직 노출이 없어서 계산할 수 없어요.", tone: "neutral" };
  const per1000 = Math.max(0, Math.round(ctr * 10));
  const base = `광고를 본 1,000명 중 약 ${per1000}명이 클릭했어요.`;
  if (ctr >= CTR_GOOD_THRESHOLD) return { caption: `${base} 클릭률이 좋은 편이에요.`, tone: "good" };
  if (ctr >= CTR_OKAY_THRESHOLD) return { caption: `${base} 무난한 편이에요.`, tone: "okay" };
  return { caption: `${base} 소재나 타겟팅을 점검해볼 만해요.`, tone: "bad" };
}

/**
 * CPA(전환 1건당 비용)만 놓고는 "얼마가 좋은 금액인지" 판단할 기준이 없다 — 상품마다 전환 하나의
 * 가치가 다 다르기 때문이다. 그 판단은 이미 매출 대비로 계산되는 ROAS에 들어있으므로, 색은
 * ROAS 판단을 그대로 따르고 문장만 CPA에 맞게 쓴다.
 */
export function explainCpa(cpa: number, conversions: number, roasTone: MetricTone): MetricExplanation {
  if (conversions <= 0) return { caption: "아직 전환(구매·문의 등)이 없어서 계산할 수 없어요.", tone: "neutral" };
  return { caption: `전환 1건을 만드는 데 평균 ${formatKRW(Math.round(cpa))}원을 썼어요.`, tone: roasTone };
}
