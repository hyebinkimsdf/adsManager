import type { ConversionEventType, SiteElement } from "@/lib/mock/types";
import type { TrackingRuleSuggestion } from "./trackingRulesSchema";

const TEXT_RULES: [RegExp, ConversionEventType][] = [
  [/문의|상담|예약|신청|리드|콜백/, "lead_collection"],
  [/장바구니|담기/, "add_to_cart"],
  [/구매|결제|주문|바로\s*사기|바로구매/, "purchase"],
  [/구독|정기결제|멤버십\s*가입/, "subscribe"],
  [/회원가입|가입하기/, "signup"],
  [/설치|다운로드/, "app_install"],
  [/상품\s*상세|자세히\s*보기|제품\s*보기/, "product_view"],
];

/** 온디바이스/클라우드 AI를 모두 못 쓸 때 쓰는 결정론적 규칙 기반 폴백. 모델 호출 없이 텍스트만 해석한다. */
export function suggestTrackingRules(elements: SiteElement[]): TrackingRuleSuggestion[] {
  const suggestions: TrackingRuleSuggestion[] = [];

  elements.forEach((el, index) => {
    const matched = TEXT_RULES.find(([pattern]) => pattern.test(el.text));

    if (el.type === "form") {
      // 텍스트로 뚜렷한 신호가 없는 폼은, 사이트에서 가장 흔한 폼 용도인 "문의"로 기본 배정한다.
      const eventType = matched?.[1] ?? "lead_collection";
      suggestions.push({ index, trigger: "submit", eventType, label: `${el.text} (자동 추정)` });
      return;
    }

    if (matched) {
      suggestions.push({ index, trigger: "click", eventType: matched[1], label: el.text });
    }
  });

  return suggestions;
}
