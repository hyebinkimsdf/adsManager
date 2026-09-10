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
  events = events.filter((event) => event.source === "live");
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
      detail: `최근 수집 목록에 방문 ${needsRecovery.visits}건, 구매 완료 신고 ${needsRecovery.purchases}건이 있어요. 동일 방문자의 구매 여부와 전체 기간 성과는 확인되지 않아, 타겟 조건 검토용 초안으로 사용하세요.`,
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
      detail: `${bestConverting.campaign.name}에 구매 완료 신고 ${bestConverting.purchases}건이 수집됐어요. 고유 구매 고객 수와 매체 고객 식별 연동을 확인한 뒤 제외 조건을 검토하세요.`,
      buttonLabel: "이 타겟 바로 만들기",
      estimatedSize: events.filter((e) => e.eventType === "purchase").length,
      draft: { type: "conversion", name: "최근 구매 고객 제외", eventType: "purchase", lookbackDays: 30, mode: "exclude" },
    });
  }

  return results.slice(0, 2);
}
