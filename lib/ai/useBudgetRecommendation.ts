"use client";

import { useCallback, useEffect } from "react";
import { useAiPreparation } from "@/components/providers/OnDeviceAiProvider";
import { BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN, buildBudgetRecommendationUserTurnEn } from "./budgetRecommendationPrompt";
import { BUDGET_RECOMMENDATION_RESPONSE_SCHEMA_EN, isBudgetRecommendationReply, type BudgetRecommendationReply } from "./budgetRecommendationSchema";
import { templateBudgetReasoning, type BudgetRecommendationFacts } from "@/lib/campaigns/budgetRecommendation";
import { useOnDeviceAi, type OnDeviceAiConfig, type Translators } from "./useOnDeviceAi";
import type { EngineKind } from "./types";
import type { AvailabilityState } from "./useOnDeviceAi";

export type { AvailabilityState };

export interface BudgetRecommendationExplanation {
  reasoning: string;
  engine: EngineKind;
}

interface UseBudgetRecommendationResult {
  state: AvailabilityState;
  downloadProgress: number;
  explain: (facts: BudgetRecommendationFacts) => Promise<BudgetRecommendationExplanation>;
}

function parseReply(raw: string): BudgetRecommendationReply | null {
  try {
    const parsed = JSON.parse(raw);
    return isBudgetRecommendationReply(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// 입력이 숫자·enum뿐이라 번역할 사람 텍스트가 없다 — 그대로 넘긴다.
async function translateRequest(facts: BudgetRecommendationFacts): Promise<BudgetRecommendationFacts> {
  return facts;
}

async function translateResponse(parsedEn: BudgetRecommendationReply, translators: Translators): Promise<BudgetRecommendationReply> {
  return { reasoning: await translators.toKo.translate(parsedEn.reasoning) };
}

const ON_DEVICE_CONFIG: OnDeviceAiConfig<BudgetRecommendationFacts, BudgetRecommendationReply, BudgetRecommendationReply> = {
  logTag: "budget-recommendation",
  systemPromptEn: BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN,
  responseSchemaEn: BUDGET_RECOMMENDATION_RESPONSE_SCHEMA_EN,
  buildUserTurnEn: buildBudgetRecommendationUserTurnEn,
  translateRequest,
  parseResponse: parseReply,
  translateResponse,
  timeoutMs: 12000,
};

export function useBudgetRecommendation(): UseBudgetRecommendationResult {
  const { runtime } = useAiPreparation();
  const { state, downloadProgress, runOnDevice } = useOnDeviceAi(ON_DEVICE_CONFIG);

  useEffect(() => {
    runtime.setActiveFeature(BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN);
    return () => runtime.setActiveFeature(null);
  }, [runtime]);

  const explain = useCallback(
    async (facts: BudgetRecommendationFacts): Promise<BudgetRecommendationExplanation> => {
      const reply = await runOnDevice(facts);
      if (reply) return { reasoning: reply.reasoning, engine: "on-device" };
      return { reasoning: templateBudgetReasoning(facts), engine: "preview" };
    },
    [runOnDevice]
  );

  return { state, downloadProgress, explain };
}
