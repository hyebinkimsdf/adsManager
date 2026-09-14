import type { Campaign, CampaignTotals } from "../mock/types";
import { sumHistory } from "../mock/campaigns";
import { formatKRW, formatPercent } from "../format";
import type { AssistantReply } from "./types";

export type MetricKey = "conversionRate" | "ctr" | "cpa" | "roas" | "spend";

export interface MetricConfig {
  label: string;
  /** true면 값이 클수록 좋은 지표(전환율·CTR·ROAS), false면 작을수록 좋은 지표(CPA). */
  higherIsBetter: boolean;
  format: (value: number) => string;
  /** format() 결과 뒤에 붙는 조사 — "원"으로 끝나면 받침 때문에 "으로", "%"로 끝나면 "로". */
  unitParticle: "로" | "으로";
  /** 계산에 필요한 분모가 0이면 null — 순위 비교에서 제외하고 "데이터 부족"으로 안내한다. */
  value: (totals: CampaignTotals) => number | null;
  /** 표본이 이 정도로 작으면 순위가 흔들리기 쉬워, 답변에 참고용이라는 안내를 덧붙인다. */
  lowSample: (totals: CampaignTotals) => boolean;
}

export const METRICS: Record<MetricKey, MetricConfig> = {
  conversionRate: {
    label: "전환율",
    higherIsBetter: true,
    format: (v) => formatPercent(v, 1),
    unitParticle: "로",
    value: (t) => (t.clicks > 0 ? (t.conversions / t.clicks) * 100 : null),
    lowSample: (t) => t.clicks < 30,
  },
  ctr: {
    label: "CTR(클릭률)",
    higherIsBetter: true,
    format: (v) => formatPercent(v, 2),
    unitParticle: "로",
    value: (t) => (t.impressions > 0 ? t.ctr : null),
    lowSample: (t) => t.impressions < 300,
  },
  roas: {
    label: "ROAS(광고수익률)",
    higherIsBetter: true,
    format: (v) => formatPercent(v, 0),
    unitParticle: "로",
    value: (t) => (t.spend > 0 ? t.roas : null),
    lowSample: (t) => t.spend < 10000,
  },
  cpa: {
    label: "CPA(전환당 비용)",
    higherIsBetter: false,
    format: (v) => `${formatKRW(v)}원`,
    unitParticle: "으로",
    value: (t) => (t.conversions > 0 ? t.cpa : null),
    lowSample: (t) => t.conversions < 5,
  },
  spend: {
    label: "지출",
    higherIsBetter: true,
    format: (v) => `${formatKRW(v)}원`,
    unitParticle: "으로",
    value: (t) => t.spend,
    lowSample: () => false,
  },
};

// 순서가 중요하다 — CPA(전환당 비용)가 "비용"을 포함해 지출 패턴보다 먼저 검사해야 오검출을 피한다.
// "성과/효율/실적/효과/가성비"는 구체적 지표명이 없을 때만 쓰는 최후순위 fallback이라 맨 뒤에
// 둔다 — 메시지에 ROAS/CPA 같은 구체적 지표가 같이 있으면 그쪽이 항상 먼저 매치된다. 전부 ROAS로
// 매핑하는 건 "돈 대비 얼마나 남는가"라는 같은 질문의 다른 표현이기 때문이다. "성과 좋은/낮은
// 캠페인"처럼 방향 단어와 짝지어질 때만 실제로 순위 비교가 발동하고(resolveAscending), "성과
// 어때?"처럼 방향 단어가 없는 막연한 질문은 그대로 not_query로 빠져 나노의 일반 대화로 넘어간다.
const METRIC_PATTERNS: [MetricKey, RegExp][] = [
  ["conversionRate", /전환\s*율|전환\s*률/],
  ["cpa", /CPA|전환\s*당\s*비용|전환\s*단가/i],
  ["roas", /ROAS|광고\s*수익률|수익률/i],
  ["ctr", /CTR|클릭\s*률|클릭\s*율/i],
  ["spend", /지출|소진|광고비/],
  ["roas", /성과|효율|실적|효과|가성비/],
];

const LOW_WORD = /낮은|낮아|낮게|최저|적은/;
const HIGH_WORD = /높은|높아|높게|최고|많은/;
const BAD_WORD = /나쁜|안\s*좋은|아쉬운|저조|부진/;
const GOOD_WORD = /좋은|우수|잘\s*나가는|잘되는/;

export function detectMetric(text: string): MetricKey | null {
  for (const [key, pattern] of METRIC_PATTERNS) {
    if (pattern.test(text)) return key;
  }
  return null;
}

/**
 * true면 오름차순(가장 낮은 값이 1등), false면 내림차순(가장 높은 값이 1등), 방향을 못 읽으면 null.
 * "낮은/높은"은 지표와 무관하게 글자 그대로, "나쁜/좋은"은 지표별 좋고 나쁨 방향(CPA는 반대)을 따진다.
 */
export function resolveAscending(text: string, config: MetricConfig): boolean | null {
  if (LOW_WORD.test(text)) return true;
  if (HIGH_WORD.test(text)) return false;
  if (BAD_WORD.test(text)) return config.higherIsBetter;
  if (GOOD_WORD.test(text)) return !config.higherIsBetter;
  return null;
}

function findMentioned(text: string, campaigns: Campaign[]): Campaign | undefined {
  return campaigns.find((c) => text.includes(c.name));
}

export type PerformanceQueryOutcome = { kind: "not_query" } | { kind: "resolved"; reply: AssistantReply };

/**
 * 전환율·CTR·CPA·ROAS·지출 비교/조회는 nano 모델의 판단에 맡기지 않고 여기서 결정론적으로 계산한다.
 * 지표별 "좋다/나쁘다" 방향과 0으로 나누기 같은 예외를 모델 추론에 맡기면 정확도가 흔들리기 때문이다.
 * 지표 키워드 + (캠페인 이름 언급 또는 방향 단어) 조합이 뚜렷할 때만 처리하고, 그 외(예: "성과 어때?"
 * 처럼 막연한 질문)는 not_query를 반환해 nano의 일반 대화로 넘긴다.
 */
export function handlePerformanceQuery(message: string, campaigns: Campaign[]): PerformanceQueryOutcome {
  const text = message.trim();
  const metricKey = detectMetric(text);
  if (!metricKey) return { kind: "not_query" };
  const config = METRICS[metricKey];

  if (campaigns.length === 0) {
    return { kind: "resolved", reply: { reply: "아직 등록된 캠페인이 없어요.", actions: [] } };
  }

  const mentioned = findMentioned(text, campaigns);
  const ascending = resolveAscending(text, config);

  if (mentioned && ascending === null) {
    return { kind: "resolved", reply: singleCampaignReply(mentioned, config) };
  }
  if (ascending === null) return { kind: "not_query" };

  return { kind: "resolved", reply: rankingReply(campaigns, config, ascending) };
}

function singleCampaignReply(campaign: Campaign, config: MetricConfig): AssistantReply {
  const totals = sumHistory(campaign.history);
  const value = config.value(totals);
  if (value === null) {
    return { reply: `${campaign.name}은 아직 ${config.label}을 계산할 데이터가 부족해요.`, actions: [] };
  }
  const caveat = config.lowSample(totals) ? " 다만 표본이 적어 참고만 해주세요." : "";
  return { reply: `${campaign.name}의 ${config.label}은 ${config.format(value)}예요.${caveat}`, actions: [] };
}

interface Evaluated {
  campaign: Campaign;
  totals: CampaignTotals;
  value: number;
}

function rankingReply(campaigns: Campaign[], config: MetricConfig, ascending: boolean): AssistantReply {
  const evaluated = campaigns.map((c) => ({ campaign: c, totals: sumHistory(c.history) }));
  const ranked = evaluated
    .map((e) => ({ ...e, value: config.value(e.totals) }))
    .filter((e): e is Evaluated => e.value !== null)
    .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value));

  if (ranked.length === 0) {
    return { reply: `${config.label}을 계산할 수 있는 캠페인이 없어요. 클릭·전환 데이터가 아직 부족해요.`, actions: [] };
  }

  const top = ranked[0];
  const excludedCount = evaluated.length - ranked.length;
  const directionWord = ascending ? "가장 낮아요" : "가장 높아요";
  const excludedNote = excludedCount > 0 ? ` (데이터가 부족한 ${excludedCount}개 캠페인은 제외했어요)` : "";
  const caveat = config.lowSample(top.totals) ? " 다만 표본이 적어 참고만 해주세요." : "";

  return {
    reply: `${top.campaign.name}이 ${config.label} ${config.format(top.value)}${config.unitParticle} ${directionWord}.${excludedNote}${caveat}`,
    actions: [],
  };
}
