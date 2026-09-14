import { MIN_RECOMMENDED_DAYS, planDays, type CampaignSetupDraft, type CampaignSetupOptions } from "./setup";
import { formatKRW } from "../format";
import type { Campaign } from "../mock/types";

export interface SetupCheckItem {
  id: string;
  text: string;
}

export interface SetupNextStep {
  key: string;
  text: string;
  href?: string;
  linkLabel?: string;
}

/**
 * 저장 직후 "다음에 뭘 해야 하는지" 안내. 코드를 연결했다고 바로 시작되는 게 아니므로(광고
 * 시작 기능 자체가 아직 없음) 그 사실을 숨기지 않고, 연결 여부에 따라 다른 문구를 보여준다.
 */
export function describeSetupNextSteps(created: Pick<Campaign, "trackingConnectionId">): SetupNextStep[] {
  const steps: SetupNextStep[] = [];
  if (!created.trackingConnectionId) {
    steps.push({ key: "tracking", text: "확인 코드를 연결하면 광고를 시작할 수 있어요.", href: "/tracking", linkLabel: "코드 설치 안내" });
  } else {
    steps.push({ key: "launch-pending", text: "광고 시작 기능은 아직 준비 중이에요. 지금은 설정만 저장할 수 있어요." });
  }
  steps.push({ key: "creative", text: "보여줄 배너 소재를 등록해 주세요.", href: "/creatives", linkLabel: "소재 등록하기" });
  return steps;
}

/**
 * 저장을 막지는 않는 참고용 점검이다 — 원클릭 저장이라는 흐름은 지키되, 눈에 잘 안 띄는
 * 약점(예산 부족·기간 짧음·추적 미연결·업종 미지정)만은 저장 전에 짚어준다.
 *
 * recommendation·hasTrackingConnection은 서버에서 받아오는 값이라 아직 못 받았으면 undefined를
 * 넘긴다 — 그 두 항목만 잠깐 건너뛰고, 기간·업종처럼 입력값만으로 바로 알 수 있는 점검은
 * 네트워크 응답을 기다리지 않고 매 입력마다 즉시 반영된다.
 */
export function evaluateSetupChecklist(
  draft: CampaignSetupDraft,
  recommendation: CampaignSetupOptions["budgetRecommendation"] | undefined,
  hasTrackingConnection: boolean | undefined,
): SetupCheckItem[] {
  const items: SetupCheckItem[] = [];

  if (recommendation?.totalBudget != null && draft.totalBudget < recommendation.totalBudget * 0.5) {
    items.push({
      id: "budget-low",
      text: `참고 금액(${formatKRW(recommendation.totalBudget)}원)의 절반도 안 돼요. 노출이 적어 데이터가 잘 안 쌓일 수 있어요.`,
    });
  }

  // 자릿수를 잘못 입력하는 실수(예: 0을 하나 더 붙임)를 잡아준다 — 낮은 쪽만 보던 걸 보완.
  if (recommendation?.totalBudget != null && draft.totalBudget > recommendation.totalBudget * 5) {
    items.push({
      id: "budget-high",
      text: `참고 금액(${formatKRW(recommendation.totalBudget)}원)보다 훨씬 높아요. 자릿수를 잘못 입력하진 않았는지 확인해 주세요.`,
    });
  }

  if (draft.endDate !== null) {
    const days = planDays(draft.startDate, draft.endDate);
    if (days < MIN_RECOMMENDED_DAYS) {
      items.push({ id: "duration-short", text: `기간이 ${days}일이에요. 보통 ${MIN_RECOMMENDED_DAYS}일은 돼야 성과를 비교할 만큼 쌓여요.` });
    }
  }

  if (hasTrackingConnection === false) {
    items.push({ id: "no-tracking", text: "확인 코드가 연결되지 않아서, 저장해도 지금은 시작할 수 없어요." });
  }

  if (draft.industry === "etc") {
    items.push({ id: "industry-etc", text: "업종을 구체적으로 고르면 더 정확한 추천을 받을 수 있어요." });
  }

  return items;
}
