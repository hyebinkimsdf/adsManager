"use client";

import { useCallback } from "react";
import { TRACKING_RULES_SYSTEM_PROMPT_EN, buildTrackingRulesUserTurnEn } from "./trackingRulesPrompt";
import { TRACKING_RULES_RESPONSE_SCHEMA_EN, isTrackingRulesReply, type TrackingRulesReply } from "./trackingRulesSchema";
import { suggestTrackingRules } from "./trackingRulesHeuristics";
import { useOnDeviceAi, type OnDeviceAiConfig, type Translators } from "./useOnDeviceAi";
import type { EngineKind } from "./types";
import type { SiteElement } from "@/lib/mock/types";
import type { AvailabilityState } from "./useOnDeviceAi";

export type { AvailabilityState };

export interface TrackingRulesResult {
  rules: TrackingRulesReply["rules"];
  engine: EngineKind;
}

interface UseTrackingRulesResult {
  state: AvailabilityState;
  downloadProgress: number;
  generate: (elements: SiteElement[]) => Promise<TrackingRulesResult>;
}

// index가 입력 요소 개수 범위 안인지는 요소 개수(번역 전 input)가 있어야 검증할 수 있다.
function parseTrackingRulesReply(raw: string, elements: SiteElement[]): TrackingRulesReply | null {
  try {
    const parsed = JSON.parse(raw);
    return isTrackingRulesReply(parsed, elements.length) ? parsed : null;
  } catch {
    return null;
  }
}

async function translateRequest(elements: SiteElement[], translators: Translators): Promise<SiteElement[]> {
  const texts = await Promise.all(elements.map((el) => translators.toEn.translate(el.text)));
  return elements.map((el, i) => ({ ...el, text: texts[i] }));
}

// index/trigger/eventType는 언어와 무관 — label만 한국어로 번역한다.
async function translateResponse(parsedEn: TrackingRulesReply, translators: Translators): Promise<TrackingRulesReply> {
  const rules = await Promise.all(
    parsedEn.rules.map(async (rule) => ({ ...rule, label: await translators.toKo.translate(rule.label) }))
  );
  return { rules };
}

const ON_DEVICE_CONFIG: OnDeviceAiConfig<SiteElement[], TrackingRulesReply, TrackingRulesReply> = {
  logTag: "tracking-rules",
  systemPromptEn: TRACKING_RULES_SYSTEM_PROMPT_EN,
  responseSchemaEn: TRACKING_RULES_RESPONSE_SCHEMA_EN,
  buildUserTurnEn: buildTrackingRulesUserTurnEn,
  translateRequest,
  parseResponse: parseTrackingRulesReply,
  translateResponse,
  timeoutMs: 12000,
};

export function useTrackingRules(): UseTrackingRulesResult {
  const { state, downloadProgress, runOnDevice } = useOnDeviceAi(ON_DEVICE_CONFIG);

  const generate = useCallback(
    async (elements: SiteElement[]): Promise<TrackingRulesResult> => {
      const reply = await runOnDevice(elements);
      if (reply) return { rules: reply.rules, engine: "on-device" };

      return { rules: suggestTrackingRules(elements), engine: "preview" };
    },
    [runOnDevice]
  );

  return { state, downloadProgress, generate };
}
