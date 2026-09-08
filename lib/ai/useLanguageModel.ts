"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SYSTEM_PROMPT_EN, buildUserTurnEn } from "./systemPrompt";
import { ASSISTANT_RESPONSE_SCHEMA_EN } from "./schema";
import { mockAssistantReply } from "./mockAssistant";
import { fetchGeminiReply } from "./geminiChatClient";
import { checkTranslatorAvailability, createTranslator, type TranslatorAvailability } from "./translator";
import type { AssistantReply, CampaignSnapshot, EngineKind } from "./types";
import { snapshotsToPromptJson } from "./context";
import type { LanguageModelSession, TranslatorSession } from "./global";

export type AvailabilityState =
  | "checking"
  | "unsupported"
  | "downloadable"
  | "downloading"
  | "available"
  | "error";

// 크롬 Prompt API는 아직 한국어 입출력을 공식 지원하지 않는다(2026년 9월 기준 en/ja/es/de/fr만 지원).
// 그래서 온디바이스 모델 자체는 영어로 돌리고, 별도의 온디바이스 Translator API로
// "한국어 질문 → 영어 번역 → 영어로 생성 → 한국어 번역" 다리를 놓아 우회한다.
const EN_TEXT = { type: "text" as const, languages: ["en"] };

interface Translators {
  toEn: TranslatorSession;
  toKo: TranslatorSession;
}

export interface AskResult {
  reply: AssistantReply;
  engine: EngineKind;
}

interface UseLanguageModelResult {
  state: AvailabilityState;
  engine: EngineKind;
  downloadProgress: number;
  ask: (message: string, campaigns: CampaignSnapshot[]) => Promise<AskResult>;
}

function safeParseReply(raw: string): AssistantReply | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.reply === "string" &&
      Array.isArray(parsed.actions)
    ) {
      return parsed as AssistantReply;
    }
    return null;
  } catch {
    return null;
  }
}

// 여러 개의 "unavailable/downloadable/downloading/available" 상태를 하나로 합칠 때,
// 셋 중 가장 준비가 덜 된 상태를 전체 상태로 취급한다(하나라도 막혀 있으면 우회 경로 전체가 막힌다).
function worstOf(a: TranslatorAvailability, b: TranslatorAvailability): TranslatorAvailability {
  const rank: Record<TranslatorAvailability, number> = {
    unavailable: 0,
    downloadable: 1,
    downloading: 2,
    available: 3,
  };
  return rank[a] <= rank[b] ? a : b;
}

export function useLanguageModel(): UseLanguageModelResult {
  const [state, setState] = useState<AvailabilityState>("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const sessionRef = useRef<LanguageModelSession | null>(null);
  const creatingRef = useRef<Promise<LanguageModelSession | null> | null>(null);
  const translatorsRef = useRef<Translators | null>(null);
  const creatingTranslatorsRef = useRef<Promise<Translators | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (typeof window === "undefined" || !window.LanguageModel || !window.Translator) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const [lm, koEn, enKo] = await Promise.all([
          window.LanguageModel.availability({
            expectedInputs: [EN_TEXT],
            expectedOutputs: [EN_TEXT],
          }),
          checkTranslatorAvailability("ko", "en"),
          checkTranslatorAvailability("en", "ko"),
        ]);
        if (cancelled) return;
        const combined = [lm, koEn, enKo].reduce(worstOf);
        setState(combined === "unavailable" ? "unsupported" : combined);
      } catch {
        if (!cancelled) setState("unsupported");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureSession = useCallback(async (): Promise<LanguageModelSession | null> => {
    if (sessionRef.current) return sessionRef.current;
    if (!window.LanguageModel) return null;
    if (creatingRef.current) return creatingRef.current;

    const promise = (async () => {
      try {
        const session = await window.LanguageModel!.create({
          initialPrompts: [{ role: "system", content: SYSTEM_PROMPT_EN }],
          expectedInputs: [EN_TEXT],
          expectedOutputs: [EN_TEXT],
          monitor: (monitor) => {
            monitor.addEventListener("downloadprogress", (event) => {
              const e = event as unknown as { loaded?: number };
              if (typeof e.loaded === "number") {
                setDownloadProgress(Math.round(e.loaded * 100));
                setState("downloading");
              }
            });
          },
        });
        sessionRef.current = session;
        return session;
      } catch {
        setState("error");
        return null;
      } finally {
        creatingRef.current = null;
      }
    })();
    creatingRef.current = promise;
    return promise;
  }, []);

  const ensureTranslators = useCallback(async (): Promise<Translators | null> => {
    if (translatorsRef.current) return translatorsRef.current;
    if (!window.Translator) return null;
    if (creatingTranslatorsRef.current) return creatingTranslatorsRef.current;

    const promise = (async () => {
      try {
        const onProgress = (loaded: number) => {
          setDownloadProgress(Math.round(loaded * 100));
          setState("downloading");
        };
        const [toEn, toKo] = await Promise.all([
          createTranslator("ko", "en", onProgress),
          createTranslator("en", "ko", onProgress),
        ]);
        if (!toEn || !toKo) return null;
        translatorsRef.current = { toEn, toKo };
        return translatorsRef.current;
      } catch {
        return null;
      } finally {
        creatingTranslatorsRef.current = null;
      }
    })();
    creatingTranslatorsRef.current = promise;
    return promise;
  }, []);

  const ask = useCallback(
    async (message: string, campaigns: CampaignSnapshot[]): Promise<AskResult> => {
      const canUseOnDevice =
        state !== "unsupported" && state !== "error" && !!window.LanguageModel && !!window.Translator;
      const mockFallback = () => ({ reply: mockAssistantReply(message, campaigns), engine: "preview" as EngineKind });

      if (canUseOnDevice) {
        try {
          const onDevice = (async () => {
            const [session, translators] = await Promise.all([ensureSession(), ensureTranslators()]);
            if (!session || !translators) {
              console.warn("[assistant] 온디바이스 세션/번역기 준비 실패");
              return null;
            }

            const englishMessage = await translators.toEn.translate(message);
            const raw = await session.prompt(
              buildUserTurnEn(englishMessage, snapshotsToPromptJson(campaigns)),
              { responseConstraint: ASSISTANT_RESPONSE_SCHEMA_EN }
            );
            const parsedEn = safeParseReply(raw);
            if (!parsedEn) {
              console.warn("[assistant] 온디바이스 응답 파싱 실패, 원본 응답:", raw);
              return null;
            }

            const [translatedReply, translatedActions] = await Promise.all([
              translators.toKo.translate(parsedEn.reply),
              Promise.all(
                parsedEn.actions.map(async (action) => ({
                  ...action,
                  label: await translators.toKo.translate(action.label),
                  description: await translators.toKo.translate(action.description),
                }))
              ),
            ]);

            const reply: AssistantReply = { reply: translatedReply, actions: translatedActions };
            setState("available");
            return reply;
          })();
          // 번역 왕복이 두 번 더 붙어서 순수 생성보다 오래 걸릴 수 있어, 타임아웃을 조금 더 넉넉하게 잡는다.
          let onDeviceTimeoutId: ReturnType<typeof setTimeout>;
          const timeout = new Promise<null>((resolve) => {
            onDeviceTimeoutId = setTimeout(() => {
              console.warn("[assistant] 온디바이스 응답 9초 타임아웃");
              resolve(null);
            }, 9000);
          });
          const parsed = await Promise.race([onDevice, timeout]);
          clearTimeout(onDeviceTimeoutId!);
          if (parsed) return { reply: parsed, engine: "on-device" };
        } catch (err) {
          console.warn("[assistant] 온디바이스 호출 중 에러, 클라우드로 폴백:", err);
        }
      }

      // Firefox/Safari처럼 온디바이스 모델이 없거나 응답에 실패한 경우, 서버를 거쳐 Gemini로 폴백한다.
      try {
        const cloud = fetchGeminiReply(message, campaigns);
        // Gemini 쪽에서 과부하 재시도가 있을 수 있어 온디바이스보다 여유 있게 기다린다.
        let cloudTimeoutId: ReturnType<typeof setTimeout>;
        const timeout = new Promise<null>((resolve) => {
          cloudTimeoutId = setTimeout(() => resolve(null), 12000);
        });
        const parsed = await Promise.race([cloud, timeout]);
        clearTimeout(cloudTimeoutId!);
        if (parsed) return { reply: parsed, engine: "cloud" };
        console.warn("[assistant] 클라우드(Gemini) 응답 없음, 미리보기로 폴백");
      } catch (err) {
        console.warn("[assistant] 클라우드(Gemini) 호출 중 에러, 미리보기로 폴백:", err);
      }

      return mockFallback();
    },
    [ensureSession, ensureTranslators, state]
  );

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
      translatorsRef.current?.toEn.destroy();
      translatorsRef.current?.toKo.destroy();
    };
  }, []);

  const engine: EngineKind = state === "available" ? "on-device" : "preview";

  return { state, engine, downloadProgress, ask };
}
