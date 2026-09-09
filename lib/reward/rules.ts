import type { RewardCampaign, RewardProductType } from "@/lib/mock/types";

export const PRODUCT_LABEL: Record<RewardProductType, string> = {
  money_notification: "머니알림",
  lucky_quiz: "행운퀴즈",
  button_press: "버튼 누르기",
};

export const PRODUCT_DESCRIPTION: Record<RewardProductType, string> = {
  money_notification: "결제 알림에 자연스럽게 노출되는 푸시형 리워드 광고예요.",
  lucky_quiz: "혜택탭 전체 유저를 대상으로 하는 논타겟 퀴즈 참여형 광고예요.",
  button_press: "혜택탭 리스트에서 버튼이나 상품 이미지를 누르면 랜딩으로 이동해요.",
};

// 토스애즈 가이드에서 확인된 실제 규칙
export const MONEY_NOTIFICATION_MIN_TARGET_SIZE = 30_000;
export const MONEY_NOTIFICATION_BASE_CPP = 30;
export const MONEY_NOTIFICATION_ADVANCED_TARGETING_SURCHARGE = 10;
export const MONEY_NOTIFICATION_MAX_CPP = 100;

export const LUCKY_QUIZ_MIN_BUDGET = 1_000_000;
export const LUCKY_QUIZ_MAX_BUDGET = 20_000_000;

export const BUTTON_PRESS_MIN_DAILY_BUDGET = 100_000;

export function computeMoneyNotificationCpp(advancedTargeting: boolean): number {
  const cpp = MONEY_NOTIFICATION_BASE_CPP + (advancedTargeting ? MONEY_NOTIFICATION_ADVANCED_TARGETING_SURCHARGE : 0);
  return Math.min(MONEY_NOTIFICATION_MAX_CPP, cpp);
}

/** 캠페인 생성 폼에서 "만들기" 버튼을 누르기 전 막아야 하는 검증 — null이면 통과. */
export function validateRewardDraft(draft: Partial<RewardCampaign>): string | null {
  if (!draft.name || !draft.name.trim()) return "캠페인 이름을 입력해주세요.";

  if (draft.productType === "money_notification") {
    if (!draft.targetSize || draft.targetSize < MONEY_NOTIFICATION_MIN_TARGET_SIZE) {
      return `머니알림은 최소 타겟 규모가 ${MONEY_NOTIFICATION_MIN_TARGET_SIZE.toLocaleString()}명이에요.`;
    }
    if (!draft.dailyBudget || draft.dailyBudget < 10_000) return "일 예산을 입력해주세요.";
  }

  if (draft.productType === "lucky_quiz") {
    if (!draft.totalBudget || draft.totalBudget < LUCKY_QUIZ_MIN_BUDGET || draft.totalBudget > LUCKY_QUIZ_MAX_BUDGET) {
      return `행운퀴즈 예산은 ${LUCKY_QUIZ_MIN_BUDGET.toLocaleString()}원 ~ ${LUCKY_QUIZ_MAX_BUDGET.toLocaleString()}원 사이여야 해요.`;
    }
  }

  if (draft.productType === "button_press") {
    if (!draft.landingUrl || !/^https?:\/\/.+/.test(draft.landingUrl)) {
      return "http(s)://로 시작하는 랜딩 URL을 입력해주세요.";
    }
    if (!draft.dailyBudget || draft.dailyBudget < BUTTON_PRESS_MIN_DAILY_BUDGET) {
      return `버튼 누르기는 일 예산이 최소 ${BUTTON_PRESS_MIN_DAILY_BUDGET.toLocaleString()}원이에요.`;
    }
  }

  return null;
}
