import { CAMPAIGNS, mulberry32 } from "@/lib/mock/campaigns";
import type { ConversionEvent } from "@/lib/mock/types";

// 캠페인 시드 데이터와 같은 "오늘"을 기준으로 고정한다 — Date.now()를 쓰면 서버 렌더와
// 클라이언트 하이드레이션 시점이 달라져 타임스탬프가 어긋난다(hydration mismatch).
const SEED_ANCHOR = Date.parse("2026-09-09T09:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 캠페인의 일별 클릭·전환 수치에서 방문(page_view)·구매(purchase) 이벤트를 만들어낸다.
 * 실제 픽셀이 아직 연동되지 않은 상태에서도 Measurement 화면이 비어 보이지 않도록 하는 데모 데이터다.
 * 클릭의 전부가 방문 이벤트로 잡히지 않도록 일부러 비율을 낮춰(12~20%) 퍼널의 이탈을 표현한다.
 */
export function buildSeedEvents(): ConversionEvent[] {
  const events: ConversionEvent[] = [];

  for (const campaign of CAMPAIGNS) {
    const rand = mulberry32(campaign.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0));

    for (const day of campaign.history) {
      const daysAgo = Number(day.label.split("-")[1] ?? 0);
      const dayStart = SEED_ANCHOR - daysAgo * DAY_MS;

      const pageViewCount = Math.min(6, Math.round(day.clicks * (0.12 + rand() * 0.08)));
      for (let i = 0; i < pageViewCount; i++) {
        events.push({
          id: `evt-${campaign.id}-pv-${daysAgo}-${i}`,
          campaignId: campaign.id,
          eventType: "page_view",
          value: 0,
          occurredAt: new Date(dayStart + Math.floor(rand() * DAY_MS)).toISOString(),
          source: "legacy",
        });
      }

      const purchaseCount = Math.min(4, day.conversions);
      for (let i = 0; i < purchaseCount; i++) {
        const avgOrderValue = day.conversions > 0 ? day.revenue / day.conversions : 0;
        events.push({
          id: `evt-${campaign.id}-pur-${daysAgo}-${i}`,
          campaignId: campaign.id,
          eventType: "purchase",
          value: Math.round(avgOrderValue * (0.85 + rand() * 0.3)),
          occurredAt: new Date(dayStart + Math.floor(rand() * DAY_MS)).toISOString(),
          source: "legacy",
        });
      }

      // 상담·문의 폼 제출 — 클릭의 일부(3~7%)가 문의로 이어진다고 가정한 데모 데이터.
      const leadCount = Math.min(3, Math.round(day.clicks * (0.03 + rand() * 0.04)));
      for (let i = 0; i < leadCount; i++) {
        events.push({
          id: `evt-${campaign.id}-lead-${daysAgo}-${i}`,
          campaignId: campaign.id,
          eventType: "lead_collection",
          value: 0,
          occurredAt: new Date(dayStart + Math.floor(rand() * DAY_MS)).toISOString(),
          source: "legacy",
        });
      }
    }
  }

  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
