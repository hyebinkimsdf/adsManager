import { CAMPAIGNS } from "./campaigns";
import type { Campaign, Targeting } from "./types";
import { buildDashboardSummary, type DashboardSummary } from "@/lib/insights";
// 타입만 가져온다 — lib/campaigns/budgetAdjustments.ts는 node:crypto를 쓰는 서버 전용 모듈이라
// 런타임 코드는 절대 클라이언트 번들에 들어가면 안 된다("import type"은 컴파일 시 완전히 지워진다).
import type { BudgetAdjustmentRow, AdjustmentEffect } from "@/lib/campaigns/budgetAdjustments";

const API_BASE = "/api/campaigns";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json();
}

// dailyBudget PATCH에 실어 보내는 "왜 바뀌는지" — 서버가 Campaign 필드로 저장하진 않지만, 예산 변경
// 이력(BudgetAdjustment)에 원인을 남기는 데 쓴다. Campaign 자체 필드가 아니라 Partial<Campaign>과는
// 별도로 얹는다.
export interface BudgetChangeMeta {
  source: "recommendation" | "manual";
  reasonKind?: "lower_budget" | "raise_budget";
}

// PATCH 응답에 이미 갱신된 캠페인 전체가 담겨 있으므로, 호출부가 최신 값을 다시 조회할 필요가 없다.
function patchCampaign(id: string, patch: Partial<Campaign> & { budgetChangeSource?: string; budgetChangeReasonKind?: string }): Promise<Campaign> {
  return fetchJson<Campaign>(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

// 서버 첫 응답이 오기 전 화면이 비어 보이지 않도록 쓰는 동기 시드 스냅샷. 실제 데이터는
// getCampaigns()가 API에서 받아와 대체한다.
export function getCampaignsSeed(): Campaign[] {
  return CAMPAIGNS;
}

export function getCampaigns(): Promise<Campaign[]> {
  return fetchJson<Campaign[]>(API_BASE);
}

export function getCampaign(id: string): Promise<Campaign> {
  return fetchJson<Campaign>(`${API_BASE}/${id}`);
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchJson<DashboardSummary>(`${API_BASE}/summary`);
}

// 서버 첫 응답이 오기 전 화면이 비어 보이지 않도록 쓰는 동기 시드 스냅샷 — getCampaignsSeed와 같은 목적.
export function getDashboardSummarySeed(): DashboardSummary {
  return buildDashboardSummary(CAMPAIGNS);
}

export function updateBudget(id: string, dailyBudget: number, meta?: BudgetChangeMeta): Promise<Campaign> {
  return patchCampaign(id, {
    dailyBudget: Math.max(0, Math.round(dailyBudget)),
    ...(meta ? { budgetChangeSource: meta.source, ...(meta.reasonKind ? { budgetChangeReasonKind: meta.reasonKind } : {}) } : {}),
  });
}

export function setStatus(id: string, status: Campaign["status"]): Promise<Campaign> {
  return patchCampaign(id, { status });
}

// 퍼센트 계산과 targeting 병합에 필요한 "현재 값"은 호출부(store.ts)가 이미 들고 있는 캐시에서 읽는다 —
// 여기서 다시 목록을 조회하지 않는다.
export function updateTargeting(id: string, targeting: Targeting): Promise<Campaign> {
  return patchCampaign(id, { targeting });
}

export function addCampaign(campaign: Campaign): Promise<Campaign> {
  return fetchJson<Campaign>(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(campaign),
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/${id}`, { method: "DELETE" });
}

export function updateIndustry(id: string, industry: Campaign["industry"]): Promise<Campaign> {
  return patchCampaign(id, { industry });
}

export function updatePublishDates(id: string, startDate: string, endDate: string | null): Promise<Campaign> {
  return patchCampaign(id, { startDate, endDate });
}

// 실제 매체 연동이 없어 진짜 실적이 안 쌓이는 지금, "확인해 볼 광고 설정" 섹션이 데이터에 실제로
// 반응하는지 검증하기 위한 테스트 전용 — DB에 그대로 저장되므로 되돌리려면 같은 함수로 다시 써야 한다.
export function updateHistory(id: string, history: Campaign["history"]): Promise<Campaign> {
  return patchCampaign(id, { history });
}

export function resetToSeed(): Promise<Campaign[]> {
  return fetchJson<Campaign[]>(`${API_BASE}/reset`, { method: "POST" });
}

export function getBudgetAdjustments(campaignId: string): Promise<{ items: (BudgetAdjustmentRow & { effect: AdjustmentEffect })[] }> {
  return fetchJson(`${API_BASE}/${campaignId}/budget-adjustments`);
}
