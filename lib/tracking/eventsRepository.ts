import { buildSeedEvents } from "./seed";
import type { ConversionEvent, ConversionEventType } from "@/lib/mock/types";

const API_BASE = "/api/tracking/events";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json();
}

// 서버 첫 응답이 오기 전 화면이 비어 보이지 않도록 쓰는 동기 시드 스냅샷.
export function getEventsSeed(): ConversionEvent[] {
  return buildSeedEvents();
}

export async function getEvents(): Promise<ConversionEvent[]> {
  return fetchJson<ConversionEvent[]>(API_BASE);
}

/** 특정 캠페인의 이벤트만 서버에서 걸러 받는다 — 픽셀 설치 카드의 실시간 통계처럼
 * 캠페인 하나만 자주 폴링할 때, 전체 이벤트를 매번 받지 않아도 되게 한다. */
export async function getCampaignEvents(campaignId: string): Promise<ConversionEvent[]> {
  return fetchJson<ConversionEvent[]>(`${API_BASE}?campaignId=${encodeURIComponent(campaignId)}`);
}

/**
 * 실제 pixel.js가 하는 일을 데모 화면에서 그대로 흉내내는 테스트 전송 — "전환 및 추적 연동" 페이지에서 쓴다.
 * source: "test"로 명시해 실제 방문자 데이터(live)와 섞여 집계되지 않도록 한다.
 */
export async function sendTestEvent(
  campaignId: string,
  eventType: ConversionEventType,
  value = 0
): Promise<ConversionEvent> {
  return fetchJson<ConversionEvent>(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId, eventType, value, source: "test" }),
  });
}
