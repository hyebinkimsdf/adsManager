"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAiPreparation } from "@/components/providers/OnDeviceAiProvider";
import type { AvailabilityState } from "./onDeviceAiRuntime";
import { runOnDeviceRequest, type OnDeviceAiConfig } from "./onDeviceAiRequest";

export type { OnDeviceAiConfig } from "./onDeviceAiRequest";
export type { AvailabilityState, Translators } from "./onDeviceAiRuntime";

export interface UseOnDeviceAiResult<TInput, TOutput> {
  state: AvailabilityState;
  downloadProgress: number;
  runOnDevice: (input: TInput) => Promise<TOutput | null>;
}

export function useOnDeviceAi<TInput, TEnglishOutput, TOutput>(
  config: OnDeviceAiConfig<TInput, TEnglishOutput, TOutput>
): UseOnDeviceAiResult<TInput, TOutput> {
  const { runtime } = useAiPreparation();
  const requests = useRef(new Set<AbortController>());
  const feature = runtime.getFeatureStatus(config.systemPromptEn);

  useEffect(() => {
    const active = requests.current;
    return () => {
      active.forEach((controller) => controller.abort());
      active.clear();
    };
  }, []);

  const runOnDevice = useCallback(async (input: TInput): Promise<TOutput | null> => {
    const controller = new AbortController();
    requests.current.add(controller);
    try {
      return await runOnDeviceRequest(runtime, config, input, controller);
    } finally {
      requests.current.delete(controller);
    }
  }, [runtime, config]);

  return { state: feature?.state ?? "checking", downloadProgress: feature?.progress ?? 0, runOnDevice };
}
