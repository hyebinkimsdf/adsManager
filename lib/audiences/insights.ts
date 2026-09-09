import type { Campaign, ConversionEvent } from "@/lib/mock/types";
import { estimateRetargetingSize } from "./estimate";

export interface AudienceRecommendation {
  id: string;
  title: string;
  detail: string;
  buttonLabel: string;
  estimatedSize: number;
  draft:
    | { type: "retargeting"; name: string; sourceCampaignIds: string[]; action: "visit" | "purchase" }
    | { type: "conversion"; name: string; eventType: "purchase"; lookbackDays: number; mode: "exclude" };
}

/**
 * 캠페인별 방문 대비 구매 전환율을 계산해서, 규칙 기반으로 두 가지 타겟을 추천한다.
 * - 방문은 많은데 구매 전환율이 낮은 캠페인 → 그 방문자를 리타겟팅(재방문 유도)
 * - 구매 전환율이 가장 높은 캠페인 → 이미 구매한 사람을 제외한 전환추적 타겟(신규 고객 확보)
 * lib/insights.ts의 규칙 기반 폴백과 같은 접근이다 — AI 호출 없이도 바로 쓸 수 있는 결정론적 추천.
 */
export function buildAudienceRecommendations(campaigns: Campaign[], events: ConversionEvent[]): AudienceRecommendation[] {
  const stats = campaigns.map((c) => {
    const visits = events.filter((e) => e.campaignId === c.id && e.eventType === "page_view").length;
    const purchases = events.filter((e) => e.campaignId === c.id && e.eventType === "purchase").length;
    const rate = visits > 0 ? (purchases / visits) * 100 : 0;
    return { campaign: c, visits, purchases, rate };
  });

  const results: AudienceRecommendation[] = [];

  const needsRecovery = [...stats]
    .filter((s) => s.visits >= 5)
    .sort((a, b) => a.rate - b.rate)[0];
  if (needsRecovery && needsRecovery.rate < 15) {
    const sourceCampaignIds = [needsRecovery.campaign.id];
    results.push({
      id: `recover-${needsRecovery.campaign.id}`,
      title: `${needsRecovery.campaign.name} 방문자를 리타겟팅해보세요`,
      detail: `방문 ${needsRecovery.visits}건 중 구매는 ${needsRecovery.purchases}건(${needsRecovery.rate.toFixed(
        1
      )}%)에 그쳤어요. 구매 없이 떠난 방문자에게 다시 노출하면 회수할 여지가 있어요.`,
      buttonLabel: "이 타겟 바로 만들기",
      estimatedSize: estimateRetargetingSize(events, sourceCampaignIds, "visit"),
      draft: { type: "retargeting", name: `${needsRecovery.campaign.name} 방문 리타겟팅`, sourceCampaignIds, action: "visit" },
    });
  }

  const bestConverting = [...stats].filter((s) => s.purchases > 0).sort((a, b) => b.rate - a.rate)[0];
  if (bestConverting && bestConverting.rate >= 15) {
    results.push({
      id: `exclude-buyers-${bestConverting.campaign.id}`,
      title: "이미 구매한 고객은 제외하고 신규 고객을 늘려보세요",
      detail: `${bestConverting.campaign.name}은 방문 대비 구매 전환율이 ${bestConverting.rate.toFixed(
        1
      )}%로 높아요. 이미 구매한 사람을 제외하면 광고비가 새로운 고객에게 더 집중돼요.`,
      buttonLabel: "이 타겟 바로 만들기",
      estimatedSize: events.filter((e) => e.eventType === "purchase").length,
      draft: { type: "conversion", name: "최근 구매 고객 제외", eventType: "purchase", lookbackDays: 30, mode: "exclude" },
    });
  }

  return results.slice(0, 2);
}
