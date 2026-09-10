import type { ConversionEventType } from "@/lib/mock/types";

/** 방문(퍼널 상단)부터 구매(퍼널 하단) 순서 — 토스 픽셀 이벤트 명세의 이름을 그대로 따른다. */
export const EVENT_ORDER: ConversionEventType[] = [
  "page_view",
  "product_view",
  "add_to_cart",
  "signup",
  "lead_intent",
  "lead_collection",
  "app_install",
  "purchase_intent",
  "purchase",
  "subscribe",
];

export const EVENT_LABEL: Record<ConversionEventType, string> = {
  page_view: "페이지 조회",
  product_view: "상품 상세 조회",
  add_to_cart: "장바구니 담기",
  signup: "회원가입",
  lead_collection: "잠재고객 수집",
  lead_intent: "문의 시도",
  purchase_intent: "구매 시도",
  app_install: "앱 설치",
  purchase: "구매",
  subscribe: "구독",
};

export const EVENT_DESCRIPTION: Record<ConversionEventType, string> = {
  page_view: "사이트의 아무 페이지나 조회했을 때",
  product_view: "상품 상세 페이지를 조회했을 때",
  add_to_cart: "장바구니에 상품을 담았을 때",
  signup: "회원가입을 완료했을 때",
  lead_collection: "상담·문의 접수가 서버에서 완료된 것을 확인했을 때",
  lead_intent: "문의 버튼 클릭 또는 폼 제출 시도 — 접수 완료와 구분해요",
  purchase_intent: "구매·결제 버튼 클릭 — 결제 완료와 구분해요",
  app_install: "앱을 설치했을 때",
  purchase: "결제(구매)를 완료했을 때 — value에 결제 금액을 담아요",
  subscribe: "구독을 시작했을 때",
};

export const COMPLETION_EVENT_TYPES: ConversionEventType[] = ["purchase", "lead_collection", "signup", "subscribe", "app_install"];
export const AUTOMATIC_EVENT_TYPES: ConversionEventType[] = ["product_view", "add_to_cart", "purchase_intent", "lead_intent"];
