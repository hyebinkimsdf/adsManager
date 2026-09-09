"use client";

import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import * as repo from "./repository";
import type { RewardCampaign } from "@/lib/mock/types";

export const rewardCampaignsQueryKey = ["reward-campaigns"] as const;

export function useRewardCampaigns(): RewardCampaign[] {
  const { data } = useQuery({
    queryKey: rewardCampaignsQueryKey,
    queryFn: repo.getRewardCampaigns,
    initialData: [] as RewardCampaign[],
  });
  return data;
}

export async function createRewardCampaign(campaign: RewardCampaign) {
  const created = await repo.createRewardCampaign(campaign);
  queryClient.setQueryData<RewardCampaign[]>(rewardCampaignsQueryKey, (prev) => [created, ...(prev ?? [])]);
  return created;
}

export async function setRewardCampaignStatus(id: string, status: "active" | "paused") {
  const updated = await repo.setRewardCampaignStatus(id, status);
  queryClient.setQueryData<RewardCampaign[]>(rewardCampaignsQueryKey, (prev) =>
    (prev ?? []).map((c) => (c.id === id ? updated : c))
  );
  return updated;
}

export async function deleteRewardCampaign(id: string) {
  await repo.deleteRewardCampaign(id);
  queryClient.setQueryData<RewardCampaign[]>(rewardCampaignsQueryKey, (prev) => (prev ?? []).filter((c) => c.id !== id));
}
