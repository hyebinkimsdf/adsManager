"use client";

import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import * as repo from "./campaignsRepository";
import type { Campaign } from "./types";

export const campaignsQueryKey = ["campaigns"] as const;

export function useCampaigns(): Campaign[] {
  const { data } = useQuery({
    queryKey: campaignsQueryKey,
    queryFn: repo.getCampaigns,
    initialData: repo.getCampaignsSeed,
  });
  return data;
}

export function useCampaign(id: string): Campaign | undefined {
  const { data } = useQuery({
    queryKey: campaignsQueryKey,
    queryFn: repo.getCampaigns,
    initialData: repo.getCampaignsSeed,
    select: (campaigns) => campaigns.find((c) => c.id === id),
  });
  return data;
}

// 캠페인 목록 캐시를 직접 조작하는 쓰기 액션들. 컴포넌트 밖(applyAction 등 순수 함수)에서도
// 호출해야 해서 useMutation 대신 싱글턴 queryClient를 직접 갱신하는 방식을 쓴다.
async function applyUpdate(fn: () => Promise<Campaign[]>): Promise<Campaign[]> {
  const campaigns = await fn();
  queryClient.setQueryData(campaignsQueryKey, campaigns);
  return campaigns;
}

export function updateBudget(id: string, dailyBudget: number) {
  return applyUpdate(() => repo.updateBudget(id, dailyBudget));
}

export function adjustBudgetByPercent(id: string, percent: number) {
  return applyUpdate(() => repo.adjustBudgetByPercent(id, percent));
}

export function setStatus(id: string, status: Campaign["status"]) {
  return applyUpdate(() => repo.setStatus(id, status));
}

export function updateTargeting(id: string, targeting: Partial<Campaign["targeting"]>) {
  return applyUpdate(() => repo.updateTargeting(id, targeting));
}

export function adjustKeywordBidsByPercent(id: string, percent: number) {
  return applyUpdate(() => repo.adjustKeywordBidsByPercent(id, percent));
}

export function addKeywords(id: string, keywords: string[]) {
  return applyUpdate(() => repo.addKeywords(id, keywords));
}

export function addCampaign(campaign: Campaign) {
  return applyUpdate(() => repo.addCampaign(campaign));
}

export function deleteCampaign(id: string) {
  return applyUpdate(() => repo.deleteCampaign(id));
}

export function updateIndustry(id: string, industry: Campaign["industry"]) {
  return applyUpdate(() => repo.updateIndustry(id, industry));
}

export function resetToSeed() {
  return applyUpdate(() => repo.resetToSeed());
}
