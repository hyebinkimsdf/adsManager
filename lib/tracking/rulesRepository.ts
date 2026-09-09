import type { EventRule, SiteScan } from "@/lib/mock/types";

const SCAN_API_BASE = "/api/tracking/scan";
const RULES_API_BASE = "/api/tracking/rules";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json();
}

/** "AI 자동 설정"의 입력 데이터 — pixel.js가 방문자 브라우저에서 크롤링해 보낸 최신 스캔 1건. */
export async function getLatestScan(campaignId: string): Promise<SiteScan | null> {
  return fetchJson<SiteScan | null>(`${SCAN_API_BASE}?campaignId=${encodeURIComponent(campaignId)}`);
}

/** 캠페인에 현재 활성화된 자동 추적 규칙 목록. */
export async function getEventRules(campaignId: string): Promise<EventRule[]> {
  return fetchJson<EventRule[]>(`${RULES_API_BASE}?campaignId=${encodeURIComponent(campaignId)}`);
}

/** AI가 제안하고 관리자가 승인한 규칙으로 캠페인의 전체 규칙을 교체 저장한다. */
export async function saveEventRules(
  campaignId: string,
  rules: Pick<EventRule, "selector" | "trigger" | "eventType" | "label">[]
): Promise<EventRule[]> {
  return fetchJson<EventRule[]>(RULES_API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId, rules }),
  });
}
