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
//
// PATCH/POST 응답에는 이미 서버가 반영한 최신 캠페인이 담겨 있으므로, 캐시 배열 안의 해당 항목만
// 그 값으로 교체(또는 추가/제거)한다 — 매 변경마다 전체 목록을 다시 조회하지 않는다.
function getCachedCampaign(id: string): Campaign | undefined {
  return queryClient.getQueryData<Campaign[]>(campaignsQueryKey)?.find((c) => c.id === id);
}

function replaceCampaign(campaign: Campaign) {
  queryClient.setQueryData<Campaign[]>(campaignsQueryKey, (prev) =>
    prev?.map((c) => (c.id === campaign.id ? campaign : c))
  );
  return campaign;
}

async function applyUpdate(fn: () => Promise<Campaign>): Promise<Campaign> {
  return replaceCampaign(await fn());
}

export function updateBudget(id: string, dailyBudget: number) {
  return applyUpdate(() => repo.updateBudget(id, dailyBudget));
}

export function adjustBudgetByPercent(id: string, percent: number) {
  const current = getCachedCampaign(id);
  if (!current) return Promise.reject(new Error("캠페인 정보를 불러오지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요."));
  const dailyBudget = Math.max(0, Math.round(current.dailyBudget * (1 + percent / 100)));
  return applyUpdate(() => repo.updateBudget(id, dailyBudget));
}

export function setStatus(id: string, status: Campaign["status"]) {
  return applyUpdate(() => repo.setStatus(id, status));
}

export function updateTargeting(id: string, targeting: Partial<Campaign["targeting"]>) {
  const current = getCachedCampaign(id);
  if (!current) return Promise.reject(new Error("캠페인 정보를 불러오지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요."));
  return applyUpdate(() => repo.updateTargeting(id, { ...current.targeting, ...targeting }));
}

export async function addCampaign(campaign: Campaign) {
  const created = await repo.addCampaign(campaign);
  queryClient.setQueryData<Campaign[]>(campaignsQueryKey, (prev) => (prev ? [created, ...prev] : [created]));
  return created;
}

export async function deleteCampaign(id: string) {
  await repo.deleteCampaign(id);
  queryClient.setQueryData<Campaign[]>(campaignsQueryKey, (prev) => prev?.filter((c) => c.id !== id));
}

export function updateIndustry(id: string, industry: Campaign["industry"]) {
  return applyUpdate(() => repo.updateIndustry(id, industry));
}

export async function resetToSeed() {
  const campaigns = await repo.resetToSeed();
  queryClient.setQueryData(campaignsQueryKey, campaigns);
  return campaigns;
}
