import type { Campaign, CampaignTotals } from "../mock/types";
import { sumHistory } from "../mock/campaigns";
import { formatKRW } from "../format";
import type { AssistantAction, AssistantReply, RiskLevel } from "./types";
import { METRICS, detectMetric, resolveAscending, type MetricKey } from "./performanceQuery";

// "낮은 캠페인 알려줘"(조회, performanceQuery.ts가 처리)와 "낮은 캠페인 개선해줘"(조치 요청)를
// 구분하는 단어. 이 단어가 있으면 순위만 답하지 않고 원인 진단 + 실행 가능한 제안까지 만든다.
const ACTION_INTENT_WORD = /(개선|조치|추천해|제안해|해결해|어떻게\s*해야|뭘\s*해야)/;

// decideWeeklyRecommendations(lib/insights.ts)와 같은 기준 — ROAS가 이 아래면 "저효율"로 본다.
const LOW_ROAS_THRESHOLD = 150;
// 대시보드 주간 추천과 동일한 감액 폭 — 앱 전체에서 일관된 수치를 쓴다.
const LOWER_BUDGET_PERCENT = -20;

const MEDIUM_RISK: RiskLevel = "medium";
const HIGH_RISK: RiskLevel = "high";

export function hasImprovementIntent(text: string): boolean {
  return ACTION_INTENT_WORD.test(text);
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `improve-action-${counter}`;
}

function findMentioned(text: string, campaigns: Campaign[]): Campaign | undefined {
  return campaigns.find((c) => text.includes(c.name));
}

interface Evaluated {
  campaign: Campaign;
  totals: CampaignTotals;
  value: number;
}

function rankByMetric(campaigns: Campaign[], metricKey: MetricKey, ascending: boolean): Evaluated[] {
  const config = METRICS[metricKey];
  return campaigns
    .map((c) => ({ campaign: c, totals: sumHistory(c.history) }))
    .map((e) => ({ ...e, value: config.value(e.totals) }))
    .filter((e): e is Evaluated => e.value !== null)
    .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value));
}

function averageRoas(campaigns: Campaign[]): number {
  const spending = campaigns.map((c) => sumHistory(c.history)).filter((t) => t.spend > 0);
  if (spending.length === 0) return 0;
  return spending.reduce((sum, t) => sum + t.roas, 0) / spending.length;
}

export type ImprovementOutcome = { kind: "not_applicable" } | { kind: "resolved"; reply: AssistantReply };

/**
 * "전환률 낮은 캠페인 개선해줘"처럼 지표 조회에 조치 요청이 같이 붙은 문장은 performanceQuery.ts의
 * 순위 조회만으로는 부족하다 — 대상을 고르고, 왜 안 좋은지 진단하고, 실행 가능한 조정안(예산 감액
 * 또는 일시중지)까지 여기서 결정론적으로 만든다. 실제로 계정에 손해를 주는 판단이라 나노의 추론에
 * 맡기지 않고, 지표 판단은 lib/insights.ts의 주간 추천과 같은 기준(ROAS 150% 미만 = 저효율,
 * 20% 감액)을 그대로 재사용해 앱 전체에서 같은 결론이 나오게 한다.
 */
export function handleImprovementRequest(message: string, campaigns: Campaign[]): ImprovementOutcome {
  const text = message.trim();
  if (!hasImprovementIntent(text)) return { kind: "not_applicable" };

  if (campaigns.length === 0) {
    return { kind: "resolved", reply: { reply: "아직 등록된 캠페인이 없어요.", actions: [] } };
  }

  const metricKey = detectMetric(text) ?? "roas";
  const config = METRICS[metricKey];
  const mentioned = findMentioned(text, campaigns);
  // 방향 단어가 없으면("캠페인 개선해줘") 나쁜 쪽부터 본다는 뜻으로 오름차순(최저값 우선)을 기본으로 한다.
  const ascending = resolveAscending(text, config) ?? true;

  const target = mentioned
    ? { campaign: mentioned, totals: sumHistory(mentioned.history), value: config.value(sumHistory(mentioned.history)) }
    : rankByMetric(campaigns, metricKey, ascending)[0];

  if (!target || target.value === null) {
    return { kind: "resolved", reply: { reply: `${config.label}을 계산할 수 있는 캠페인이 없어요. 데이터가 더 쌓이면 다시 확인해볼게요.`, actions: [] } };
  }

  const { campaign, totals } = target;

  if (totals.spend === 0) {
    return {
      kind: "resolved",
      reply: { reply: `${campaign.name}은 아직 지출 데이터가 없어서 개선 방향을 판단하기 어려워요.`, actions: [] },
    };
  }

  if (totals.conversions === 0) {
    const action: AssistantAction = {
      id: nextId(),
      type: "pause_campaign",
      label: "캠페인 일시중지",
      description: `${campaign.name}을 일시중지해요.`,
      campaignId: campaign.id,
      riskLevel: HIGH_RISK,
    };
    return {
      kind: "resolved",
      reply: {
        reply: `${campaign.name}은 최근 ${formatKRW(totals.spend)}원을 썼지만 전환이 하나도 없었어요. 일단 일시중지하고 소재·타겟을 다시 점검해보는 걸 추천드려요. 진행할까요?`,
        actions: [action],
      },
    };
  }

  if (totals.roas < LOW_ROAS_THRESHOLD) {
    const avgRoas = averageRoas(campaigns);
    const action: AssistantAction = {
      id: nextId(),
      type: "adjust_budget",
      label: `일 예산 ${LOWER_BUDGET_PERCENT}%`,
      description: `${campaign.name}의 일 예산을 줄여요.`,
      campaignId: campaign.id,
      percent: LOWER_BUDGET_PERCENT,
      riskLevel: MEDIUM_RISK,
    };
    return {
      kind: "resolved",
      reply: {
        reply: `${campaign.name}의 ROAS가 ${totals.roas.toFixed(0)}%로 낮은 편이에요(계정 평균 ${avgRoas.toFixed(0)}%). 예산을 20% 줄여서 효율부터 개선해보는 걸 추천드려요. 진행할까요?`,
        actions: [action],
      },
    };
  }

  return {
    kind: "resolved",
    reply: {
      reply: `${campaign.name}이 상대적으로 ${config.label}이 낮긴 하지만, ROAS ${totals.roas.toFixed(0)}%로 아직 손해 보는 수준은 아니에요. 지금 당장 큰 조정은 필요해 보이지 않아요.`,
      actions: [],
    },
  };
}
