import type { Campaign } from "../mock/types";
import { sumHistory, trendPercent } from "../mock/campaigns";
import type { AssistantReply, CampaignSnapshot } from "./types";

export function buildSnapshots(campaigns: Campaign[]): CampaignSnapshot[] {
  return campaigns.map((c) => {
    const totals = sumHistory(c.history);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      industry: c.industry,
      dailyBudget: c.dailyBudget,
      ctr: totals.ctr,
      cpa: totals.cpa,
      roas: totals.roas,
      spendTrendPercent: trendPercent(c.history, "spend"),
      setupStatus: c.setupStatus,
    };
  });
}

/**
 * 캠페인 이름을 참조할 안정적인 토큰 — 숫자만으로 구성해 영→한 기계번역을 거쳐도 형태가
 * 거의 항상 보존된다. id로부터 결정론적으로 계산하므로, 매 턴 목록 순서가 바뀌거나 이번
 * 턴에 컨텍스트를 다시 안 보내도(useOnDeviceAi의 contextRefresh 생략) 항상 같은 캠페인에
 * 같은 토큰이 매겨진다 — "#1, #2" 같은 위치 기반 번호였다면 그 보장이 깨졌을 것이다.
 */
export function campaignRef(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `#${hash % 100000}`;
}

export function buildCampaignRefMap(snapshots: CampaignSnapshot[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of snapshots) map[campaignRef(s.id)] = s.name;
  return map;
}

const REF_PATTERN = /#\d+/g;

/**
 * 모델·번역기를 거친 답변에서 참조 토큰을 실제 한글 캠페인 이름으로 되돌린다. 모델에게
 * 애초에 이름(한글)을 보여주지 않고 토큰만 준 뒤 이 치환으로 이름을 채우면, 표시되는
 * 이름이 모델의 번역 품질과 무관하게 항상 정확하다 — "시드"가 "씨앗"으로 둔갑하는 문제를
 * 프롬프트 지시가 아니라 코드로 원천 차단한다. 모르는 토큰은 건드리지 않고 그대로 둔다.
 */
export function resolveCampaignRefs(reply: AssistantReply, snapshots: CampaignSnapshot[]): AssistantReply {
  const refMap = buildCampaignRefMap(snapshots);
  const substitute = (text: string) => text.replace(REF_PATTERN, (token) => refMap[token] ?? token);
  return {
    ...reply,
    reply: substitute(reply.reply),
    actions: reply.actions.map((action) => ({
      ...action,
      label: substitute(action.label),
      description: substitute(action.description),
    })),
    ...(reply.quickReplies ? { quickReplies: reply.quickReplies.map(substitute) } : {}),
  };
}

// name은 의도적으로 뺀다 — 온디바이스 모델이 "영어로만 답하라"는 지시와 한글 이름을 동시에
// 받으면 이름을 영어로 옮기려 시도하고, 그 결과를 다시 한국어로 기계번역하면 원래 이름과
// 다른 말로 둔갑한다("시드 캠페인" → "Seed" → "씨앗 캠페인"). id는 actions[].campaignId에
// 그대로 쓰이므로 남겨두되(번역 대상이 아니라 안전함), 문장에서 캠페인을 가리킬 때는 ref를
// 쓰게 하고 실제 이름은 resolveCampaignRefs가 나중에 코드로 채워 넣는다.
export function snapshotsToPromptJson(snapshots: CampaignSnapshot[]): string {
  return JSON.stringify(
    snapshots.map((s) => ({
      id: s.id,
      ref: campaignRef(s.id),
      status: s.status,
      objective: s.objective,
      industry: s.industry,
      dailyBudget: s.dailyBudget,
      ctr: Number(s.ctr.toFixed(2)),
      cpa: Math.round(s.cpa),
      roas: Number(s.roas.toFixed(1)),
      spendTrend: Number(s.spendTrendPercent.toFixed(1)),
    }))
  );
}
