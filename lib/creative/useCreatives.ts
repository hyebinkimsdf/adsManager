"use client";

import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import * as repo from "./repository";
import type { Creative } from "@/lib/mock/types";

export const creativesQueryKey = ["creatives"] as const;

export function useCreativesQuery() {
  return useQuery({
    queryKey: creativesQueryKey,
    queryFn: repo.getCreatives,
  });
}

export function useCreatives(): Creative[] {
  return useCreativesQuery().data ?? [];
}

export async function createCreative(creative: Creative) {
  const created = await repo.createCreative(creative);
  queryClient.setQueryData<Creative[]>(creativesQueryKey, (prev) => [created, ...(prev ?? [])]);
  return created;
}

export async function deleteCreative(id: string) {
  await repo.deleteCreative(id);
  queryClient.setQueryData<Creative[]>(creativesQueryKey, (prev) => (prev ?? []).filter((c) => c.id !== id));
}
