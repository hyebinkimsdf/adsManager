"use client";

import { useQuery } from "@tanstack/react-query";
import * as repo from "./eventsRepository";
import type { ConversionEvent } from "@/lib/mock/types";

export const conversionEventsQueryKey = ["conversion-events"] as const;

export function useConversionEvents(): ConversionEvent[] {
  const { data } = useQuery({
    queryKey: conversionEventsQueryKey,
    queryFn: repo.getEvents,
    initialData: repo.getEventsSeed,
  });
  return data;
}
