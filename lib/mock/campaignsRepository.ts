import { CAMPAIGNS } from "./campaigns";
import type { Campaign } from "./types";

const API_BASE = "/api/campaigns";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json();
}

async function patchCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign[]> {
  await fetchJson(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return getCampaigns();
}

async function findCampaign(id: string): Promise<Campaign | undefined> {
  const campaigns = await getCampaigns();
  return campaigns.find((c) => c.id === id);
}

// 서버 첫 응답이 오기 전 화면이 비어 보이지 않도록 쓰는 동기 시드 스냅샷. 실제 데이터는
// getCampaigns()가 API에서 받아와 대체한다.
export function getCampaignsSeed(): Campaign[] {
  return CAMPAIGNS;
}

export async function getCampaigns(): Promise<Campaign[]> {
  return fetchJson<Campaign[]>(API_BASE);
}

export async function updateBudget(id: string, dailyBudget: number) {
  return patchCampaign(id, { dailyBudget: Math.max(0, Math.round(dailyBudget)) });
}

export async function adjustBudgetByPercent(id: string, percent: number) {
  const campaign = await findCampaign(id);
  if (!campaign) return getCampaigns();
  const dailyBudget = Math.max(0, Math.round(campaign.dailyBudget * (1 + percent / 100)));
  return patchCampaign(id, { dailyBudget });
}

export async function setStatus(id: string, status: Campaign["status"]) {
  return patchCampaign(id, { status });
}

export async function updateTargeting(id: string, targeting: Partial<Campaign["targeting"]>) {
  const campaign = await findCampaign(id);
  if (!campaign) return getCampaigns();
  return patchCampaign(id, { targeting: { ...campaign.targeting, ...targeting } });
}

export async function addCampaign(campaign: Campaign) {
  await fetchJson(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(campaign),
  });
  return getCampaigns();
}

export async function deleteCampaign(id: string) {
  await fetchJson(`${API_BASE}/${id}`, { method: "DELETE" });
  return getCampaigns();
}

export async function updateIndustry(id: string, industry: Campaign["industry"]) {
  return patchCampaign(id, { industry });
}

export async function resetToSeed() {
  return fetchJson<Campaign[]>(`${API_BASE}/reset`, { method: "POST" });
}
