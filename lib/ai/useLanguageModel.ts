"use client";

import { useCallback } from "react";
import { SYSTEM_PROMPT_EN, buildUserTurnEn } from "./systemPrompt";
import { ASSISTANT_RESPONSE_SCHEMA_EN } from "./schema";
import { mockAssistantReply } from "./mockAssistant";
import { useOnDeviceAi, type OnDeviceAiConfig, type Translators } from "./useOnDeviceAi";
import type { AssistantReply, CampaignSnapshot, EngineKind, ChatTurn } from "./types";
import { recentConversation, waitingCorrection, type ConversationMessage } from "./conversation";
import { resolveCampaignRefs, dropInvalidActions, snapshotsToPromptJson } from "./context";
import type { AvailabilityState } from "./useOnDeviceAi";

export type { AvailabilityState };

export interface AskResult {
  reply: AssistantReply;
  engine: EngineKind;
}

interface UseLanguageModelResult {
  state: AvailabilityState;
  downloadProgress: number;
  ask: (message: string, campaigns: CampaignSnapshot[], turns?: ChatTurn[]) => Promise<AskResult>;
}

interface AskInput {
  message: string;
  campaigns: CampaignSnapshot[];
  history: ConversationMessage[];
}

function safeParseReply(raw: string): AssistantReply | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.reply === "string" && Array.isArray(parsed.actions)) {
      return parsed as AssistantReply;
    }
    return null;
  } catch {
    return null;
  }
}

async function translateRequest(input: AskInput, translators: Translators): Promise<AskInput> {
  const [message, history] = await Promise.all([
    translators.toEn.translate(input.message),
    Promise.all(input.history.map(async turn => ({ ...turn, text: await translators.toEn.translate(turn.text) }))),
  ]);
  return { ...input, message, history };
}

function buildOnDeviceUserTurn(input: AskInput, includeFullContext: boolean): string {
  return buildUserTurnEn(input.message, includeFullContext ? snapshotsToPromptJson(input.campaigns) : null, input.history);
}

// 캠페인 데이터(campaigns)는 번역하지 않는다 — 원래도 영어 모델에 한국어 그대로 보내던 부분이라
// 이 리팩터에서 동작을 바꾸지 않았다. reply, 각 action의 label/description, quickReplies(있으면)만 번역한다.
async function translateResponse(parsedEn: AssistantReply, translators: Translators): Promise<AssistantReply> {
  const [reply, actions, quickReplies] = await Promise.all([
    translators.toKo.translate(parsedEn.reply),
    Promise.all(
      parsedEn.actions.map(async (action) => ({
        ...action,
        label: await translators.toKo.translate(action.label),
        description: await translators.toKo.translate(action.description),
      }))
    ),
    parsedEn.quickReplies ? Promise.all(parsedEn.quickReplies.map((q) => translators.toKo.translate(q))) : undefined,
  ]);
  return { reply, actions, ...(quickReplies ? { quickReplies } : {}) };
}

const ON_DEVICE_CONFIG: OnDeviceAiConfig<AskInput, AssistantReply, AssistantReply> = {
  logTag: "assistant",
  systemPromptEn: SYSTEM_PROMPT_EN,
  responseSchemaEn: ASSISTANT_RESPONSE_SCHEMA_EN,
  buildUserTurnEn: buildOnDeviceUserTurn,
  translateRequest,
  parseResponse: safeParseReply,
  translateResponse,
  // 기본 9초는 캠페인 초안(번역 2개)보다 무거운 채팅 응답(reply + 액션 최대 3개 × 2필드,
  // 최대 7개 번역)에는 타이트해 타임아웃이 잦았다 — trackingRules보다도 더 늘린다. 특히 세션이
  // 막 준비된 직후의 첫 호출은 콜드스타트 비용까지 겹쳐 12초로도 자주 타임아웃됐다.
  timeoutMs: 20000,
  // 매 요청에 화면 기록을 재구성한다. 실패하거나 늦게 끝난 이전 세션의 기억과 섞이지 않는다.
  sessionMode: "task",
};

export function useLanguageModel(): UseLanguageModelResult {
  const { state, downloadProgress, runOnDevice } = useOnDeviceAi(ON_DEVICE_CONFIG);

  const ask = useCallback(
    async (message: string, campaigns: CampaignSnapshot[], turns: ChatTurn[] = []): Promise<AskResult> => {
      const history = recentConversation(turns);
      const correction = waitingCorrection(message, history);
      if (correction) return { reply: { reply: correction, actions: [] }, engine: "preview" };
      const onDeviceReply = await runOnDevice({ message, campaigns, history });
      if (onDeviceReply) return { reply: resolveCampaignRefs(dropInvalidActions(onDeviceReply, campaigns, message), campaigns), engine: "on-device" };

      // Firefox/Safari처럼 온디바이스 모델이 없거나 응답에 실패한 경우, 규칙 기반 미리보기로 폴백한다.
      return { reply: mockAssistantReply(message, campaigns), engine: "preview" };
    },
    [runOnDevice]
  );

  return { state, downloadProgress, ask };
}
