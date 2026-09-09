import type { CampaignIndustry, DisplayObjective } from "@/lib/mock/types";
import { INDUSTRY_LABEL, OBJECTIVE_LABEL } from "@/lib/mock/campaigns";
import type { CampaignDraftSuggestion } from "./campaignDraftSchema";

const INDUSTRY_RULES: [RegExp, CampaignIndustry][] = [
  [/카페|식당|음식|베이커리|맛집/, "food"],
  [/미용|뷰티|네일|헤어|피부관리/, "beauty"],
  [/학원|과외|수업|교육|클래스/, "education"],
  [/병원|의원|치과|클리닉/, "medical"],
  [/쇼핑|온라인몰|쇼핑몰|의류|판매/, "shopping"],
  [/부동산|분양|중개/, "realestate"],
  [/보험|대출|금융/, "finance"],
  [/앱|소프트웨어|플랫폼|saas/i, "it_app"],
];

const OBJECTIVE_RULES: [RegExp, DisplayObjective][] = [
  [/설치|다운로드/, "app_install"],
  [/구매|주문|매출|판매/, "purchase"],
  [/문의|상담|예약|리드/, "leads"],
  [/방문|유입|클릭|알리고|홍보|인지도/, "visit"],
];

const DEFAULT_BUDGET = 100000;

/** 온디바이스/클라우드 AI를 모두 못 쓸 때 쓰는 결정론적 규칙 기반 폴백. 모델 호출 없이 텍스트만 해석한다. */
export function suggestCampaignDraft(description: string): CampaignDraftSuggestion {
  const industry = INDUSTRY_RULES.find(([pattern]) => pattern.test(description))?.[1] ?? "etc";
  const objective = OBJECTIVE_RULES.find(([pattern]) => pattern.test(description))?.[1] ?? "visit";

  const amountMatch = description.match(
    /(?:하루|일일|일\s*(?:예산|광고비))\s*(?:예산|광고비)?\s*(?:은|는|을|를|:)?\s*([0-9][0-9,.]*)\s*(만|천)?\s*원?/
  );
  let dailyBudget = DEFAULT_BUDGET;
  if (amountMatch) {
    const value = Number(amountMatch[1].replaceAll(",", "")) * (amountMatch[2] === "만" ? 10000 : amountMatch[2] === "천" ? 1000 : 1);
    if (Number.isInteger(value) && value >= 10000 && value <= 1000000) dailyBudget = value;
  }

  return {
    objective,
    industry,
    dailyBudget,
    name: `${INDUSTRY_LABEL[industry]} ${OBJECTIVE_LABEL[objective]} 캠페인`,
    reasoning: `설명에서 "${INDUSTRY_LABEL[industry]}" 업종과 "${OBJECTIVE_LABEL[objective]}" 목표를 나타내는 표현을 찾아 추천했어요.`,
  };
}
