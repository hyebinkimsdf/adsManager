import { CAMPAIGNS } from "./campaigns";
import type { Campaign, Targeting } from "./types";

const API_BASE = "/api/campaigns";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json();
}

// PATCH 응답에 이미 갱신된 캠페인 전체가 담겨 있으므로, 호출부가 최신 값을 다시 조회할 필요가 없다.
function patchCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
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

export function updateBudget(id: string, dailyBudget: number): Promise<Campaign> {
  return patchCampaign(id, { dailyBudget: Math.max(0, Math.round(dailyBudget)) });
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

export function resetToSeed(): Promise<Campaign[]> {
  return fetchJson<Campaign[]>(`${API_BASE}/reset`, { method: "POST" });
}
