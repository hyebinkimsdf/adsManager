"use client";

import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import * as repo from "./repository";
import type { Audience } from "@/lib/mock/types";

export const audiencesQueryKey = ["audiences"] as const;

export function useAudiencesQuery() {
  return useQuery({
    queryKey: audiencesQueryKey,
    queryFn: repo.getAudiences,
  });
}

export function useAudiences(): Audience[] {
  return useAudiencesQuery().data ?? [];
}

export async function createAudience(audience: Audience) {
  const created = await repo.createAudience(audience);
  queryClient.setQueryData<Audience[]>(audiencesQueryKey, (prev) => [created, ...(prev ?? [])]);
  return created;
}

export async function deleteAudience(id: string) {
  await repo.deleteAudience(id);
  queryClient.setQueryData<Audience[]>(audiencesQueryKey, (prev) => (prev ?? []).filter((a) => a.id !== id));
}
