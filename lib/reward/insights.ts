import type { Campaign, ConversionEvent, RewardCampaign, RewardProductType } from "@/lib/mock/types";
import { sumHistory } from "@/lib/mock/campaigns";
import { MONEY_NOTIFICATION_MIN_TARGET_SIZE, LUCKY_QUIZ_MIN_BUDGET } from "./rules";

export interface RewardRecommendation {
  productType: RewardProductType;
  /** 0~100 — 지금 데이터 기준으로 이 상품이 얼마나 효율적일지에 대한 상대 점수(실제 리워드 성과 데이터가 없어 디스플레이 캠페인 성과·전환 이벤트로 추정) */
  score: number;
  title: string;
  detail: string;
  draft:
    | { productType: "money_notification"; name: string; variant: "basic" | "live"; targetSize: number; advancedTargeting: boolean; dailyBudget: number }
    | { productType: "lucky_quiz"; name: string; totalBudget: number }
    | { productType: "button_press"; name: string; creativeType: "button" | "catalog"; dailyBudget: number };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * 리워드 캠페인 3종(머니알림/행운퀴즈/버튼누르기)을 지금 있는 디스플레이 캠페인 성과와 전환 이벤트로
 * 점수를 매겨 순위를 매긴다. 실제 리워드 캠페인 성과 데이터는 아직 없어서(신규 상품이라 이력이 없음)
 * 검증 가능한 대체 신호(ROAS/CTR/전환 이벤트/이미 운영 중인 상품 여부)로 추정하는 규칙 기반 추정치다.
 */
export function buildRewardRecommendations(
  campaigns: Campaign[],
  rewardCampaigns: RewardCampaign[],
  events: ConversionEvent[]
): RewardRecommendation[] {
  const active = campaigns.filter((c) => c.status === "active");
  const totalsList = active.map((c) => sumHistory(c.history)).filter((t) => t.spend > 0);
  const avgRoas = totalsList.length > 0 ? totalsList.reduce((s, t) => s + t.roas, 0) / totalsList.length : 0;
  const avgCtr = totalsList.length > 0 ? totalsList.reduce((s, t) => s + t.ctr, 0) / totalsList.length : 0;

  const purchaseCount = events.filter((e) => e.eventType === "purchase").length;
  const visitCount = events.filter((e) => e.eventType === "page_view").length;

  const hasActive = (type: RewardProductType) => rewardCampaigns.some((c) => c.productType === type && c.status === "active");

  const results: RewardRecommendation[] = [];

  // 머니알림 — 구매 이벤트가 쌓여 있고 기존 캠페인 효율이 좋을수록, 재구매 유도용 알림 콘텐츠로 쓰기 좋다.
  {
    let score = 55;
    const reasons: string[] = [];
    if (purchaseCount > 0) {
      score += 15;
      reasons.push(`최근 구매 전환이 ${purchaseCount}건 쌓여 있어 알림에 담을 실제 구매 사례가 있어요`);
    }
    if (avgRoas >= 150) {
      score += 15;
      reasons.push(`활성 캠페인 평균 ROAS가 ${avgRoas.toFixed(0)}%로 높아 재구매 유도 효과를 기대할 만해요`);
    }
    if (hasActive("money_notification")) {
      score -= 20;
      reasons.push("이미 운영 중인 머니알림이 있어 우선순위를 낮췄어요");
    }
    results.push({
      productType: "money_notification",
      score: clampScore(score),
      title: "머니알림으로 재구매를 유도해보세요",
      detail: reasons.length > 0 ? reasons.join(". ") + "." : "결제 알림에 자연스럽게 노출돼 적은 예산으로 테스트하기 좋아요.",
      draft: {
        productType: "money_notification",
        name: "재구매 유도 머니알림",
        variant: "basic",
        targetSize: MONEY_NOTIFICATION_MIN_TARGET_SIZE,
        advancedTargeting: false,
        dailyBudget: 100000,
      },
    });
  }

  // 행운퀴즈 — 방문은 많은데 구매 전환이 적으면(퍼널 상단은 넓은데 하단이 좁으면) 논타겟으로 도달을 넓히는 쪽이 유리하다.
  {
    let score = 50;
    const reasons: string[] = [];
    if (visitCount > 0 && purchaseCount === 0) {
      score += 20;
      reasons.push("방문은 있는데 아직 구매 전환이 없어, 논타겟으로 도달을 넓혀 인지도부터 쌓는 게 유리해요");
    } else if (visitCount > purchaseCount * 3) {
      score += 12;
      reasons.push(`방문(${visitCount}건) 대비 구매(${purchaseCount}건) 비율이 낮아 참여형으로 관심을 넓혀볼 만해요`);
    }
    if (active.length >= 3) {
      score += 8;
      reasons.push("운영 중인 캠페인이 여러 개라 예산 여력이 있는 편이에요");
    }
    if (hasActive("lucky_quiz")) {
      score -= 20;
      reasons.push("이미 운영 중인 행운퀴즈가 있어 우선순위를 낮췄어요");
    }
    results.push({
      productType: "lucky_quiz",
      score: clampScore(score),
      title: "행운퀴즈로 도달을 넓혀보세요",
      detail: reasons.length > 0 ? reasons.join(". ") + "." : "혜택탭 전체 유저에게 논타겟으로 노출돼 브랜드를 넓게 알리기 좋아요.",
      draft: { productType: "lucky_quiz", name: "브랜드 인지도 행운퀴즈", totalBudget: LUCKY_QUIZ_MIN_BUDGET },
    });
  }

  // 버튼 누르기 — 기존 캠페인 클릭률이 좋고 구매까지 이어지는 퍼널이 검증됐으면, 랜딩 연결형 참여 유도가 잘 통할 가능성이 높다.
  {
    let score = 50;
    const reasons: string[] = [];
    if (avgCtr >= 2) {
      score += 15;
      reasons.push(`활성 캠페인 평균 CTR이 ${avgCtr.toFixed(2)}%로 양호해 버튼 클릭 유도가 잘 통할 가능성이 높아요`);
    }
    if (purchaseCount > 0 && visitCount > 0) {
      score += 10;
      reasons.push("방문에서 구매까지 이어지는 흐름이 이미 검증돼 있어 랜딩 연결에 유리해요");
    }
    if (hasActive("button_press")) {
      score -= 20;
      reasons.push("이미 운영 중인 버튼 누르기가 있어 우선순위를 낮췄어요");
    }
    results.push({
      productType: "button_press",
      score: clampScore(score),
      title: "버튼 누르기로 랜딩 참여를 늘려보세요",
      detail: reasons.length > 0 ? reasons.join(". ") + "." : "혜택탭 리스트에서 버튼 클릭 한 번으로 랜딩까지 연결돼요.",
      draft: { productType: "button_press", name: "랜딩 참여 유도 캠페인", creativeType: "button", dailyBudget: 100000 },
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
