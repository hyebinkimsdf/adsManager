import type { ConversionEventType } from "@/lib/mock/types";

/** 방문(퍼널 상단)부터 구매(퍼널 하단) 순서 — 토스 픽셀 이벤트 명세의 이름을 그대로 따른다. */
export const EVENT_ORDER: ConversionEventType[] = [
  "page_view",
  "product_view",
  "add_to_cart",
  "signup",
  "lead_collection",
  "app_install",
  "purchase",
  "subscribe",
];

export const EVENT_LABEL: Record<ConversionEventType, string> = {
  page_view: "페이지 조회",
  product_view: "상품 상세 조회",
  add_to_cart: "장바구니 담기",
  signup: "회원가입",
  lead_collection: "잠재고객 수집",
  app_install: "앱 설치",
  purchase: "구매",
  subscribe: "구독",
};

export const EVENT_DESCRIPTION: Record<ConversionEventType, string> = {
  page_view: "사이트의 아무 페이지나 조회했을 때",
  product_view: "상품 상세 페이지를 조회했을 때",
  add_to_cart: "장바구니에 상품을 담았을 때",
  signup: "회원가입을 완료했을 때",
  lead_collection: "상담·문의 폼을 제출했을 때",
  app_install: "앱을 설치했을 때",
  purchase: "결제(구매)를 완료했을 때 — value에 결제 금액을 담아요",
  subscribe: "구독을 시작했을 때",
};
