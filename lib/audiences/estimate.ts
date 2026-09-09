import type { Campaign, ConversionEvent, ConversionEventType } from "@/lib/mock/types";

/** 선택한 캠페인에 방문(page_view)했거나 구매(purchase)한 이벤트 수 — 리타겟팅 규모 추정에 쓴다. */
export function estimateRetargetingSize(
  events: ConversionEvent[],
  sourceCampaignIds: string[],
  action: "visit" | "purchase"
): number {
  const eventType: ConversionEventType = action === "visit" ? "page_view" : "purchase";
  return events.filter((e) => sourceCampaignIds.includes(e.campaignId) && e.eventType === eventType).length;
}

/** 최근 lookbackDays일 내 eventType이 발생한 이벤트 수 — 전환추적 타겟 규모 추정에 쓴다. */
export function estimateConversionSize(events: ConversionEvent[], eventType: ConversionEventType, lookbackDays: number): number {
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  return events.filter((e) => e.eventType === eventType && new Date(e.occurredAt).getTime() >= cutoff).length;
}

export const LOOKBACK_OPTIONS = [2, 3, 5, 7, 14, 30, 90, 180] as const;

export function campaignNames(campaigns: Campaign[], ids: string[]): string {
  return campaigns
    .filter((c) => ids.includes(c.id))
    .map((c) => c.name)
    .join(", ");
}
