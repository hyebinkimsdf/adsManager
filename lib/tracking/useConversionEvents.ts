"use client";

import { useQuery } from "@tanstack/react-query";
import * as repo from "./eventsRepository";
import type { ConversionEvent } from "@/lib/mock/types";

export const conversionEventsQueryKey = ["conversion-events"] as const;

export function useConversionEventsQuery() {
  return useQuery({
    queryKey: conversionEventsQueryKey,
    queryFn: repo.getEvents,
  });
}

export function useConversionEvents(): ConversionEvent[] {
  return useConversionEventsQuery().data ?? [];
}
