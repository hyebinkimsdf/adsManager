import type { CampaignIndustry, DisplayObjective } from "@/lib/mock/types";

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
  [/도달|노출을|노출량|인지도|브랜드.*(알리|각인)|많은 사람/, "reach"],
  [/방문|유입|클릭|홍보/, "visit"],
];

/** 텍스트에서 목표를 규칙 기반으로 추론한다. 일치하는 규칙이 없으면 애매하다는 뜻으로 null을 돌려준다. */
export function guessObjectiveFromText(description: string): DisplayObjective | null {
  return OBJECTIVE_RULES.find(([pattern]) => pattern.test(description))?.[1] ?? null;
}

/** 텍스트에서 업종을 규칙 기반으로 추론한다. 일치하는 규칙이 없으면 애매하다는 뜻으로 null을 돌려준다. */
export function guessIndustryFromText(description: string): CampaignIndustry | null {
  return INDUSTRY_RULES.find(([pattern]) => pattern.test(description))?.[1] ?? null;
}

/** 텍스트에서 하루 예산 금액을 추출한다. 언급이 없거나 유효 범위를 벗어나면 null. */
export function parseDailyBudgetFromText(description: string): number | null {
  const amountMatch = description.match(
    /(?:하루|일일|일\s*(?:예산|광고비))\s*(?:예산|광고비)?\s*(?:은|는|을|를|:)?\s*([0-9][0-9,.]*)\s*(만|천)?\s*원?/
  );
  if (!amountMatch) return null;
  const value = Number(amountMatch[1].replaceAll(",", "")) * (amountMatch[2] === "만" ? 10000 : amountMatch[2] === "천" ? 1000 : 1);
  return Number.isInteger(value) && value >= 10000 && value <= 1000000 ? value : null;
}
