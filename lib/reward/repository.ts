import type { RewardCampaign } from "@/lib/mock/types";

const API_BASE = "/api/reward-campaigns";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json();
}

export async function getRewardCampaigns(): Promise<RewardCampaign[]> {
  return fetchJson<RewardCampaign[]>(API_BASE);
}

export async function createRewardCampaign(campaign: RewardCampaign): Promise<RewardCampaign> {
  return fetchJson<RewardCampaign>(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(campaign),
  });
}

export async function setRewardCampaignStatus(id: string, status: "active" | "paused"): Promise<RewardCampaign> {
  return fetchJson<RewardCampaign>(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function deleteRewardCampaign(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/${id}`, { method: "DELETE" });
}
