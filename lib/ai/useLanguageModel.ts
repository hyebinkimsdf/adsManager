"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SYSTEM_PROMPT, buildUserTurn } from "./systemPrompt";
import { ASSISTANT_RESPONSE_SCHEMA } from "./schema";
import { mockAssistantReply } from "./mockAssistant";
import { fetchGeminiReply } from "./geminiChatClient";
import type { AssistantReply, CampaignSnapshot, EngineKind } from "./types";
import { snapshotsToPromptJson } from "./context";
import type { LanguageModelSession } from "./global";

export type AvailabilityState =
  | "checking"
  | "unsupported"
  | "downloadable"
  | "downloading"
  | "available"
  | "error";

// 시스템 프롬프트가 한국어 응답을 강제하므로, 크롬이 실제로 한국어 출력을 지원하는지
// availability()/create() 양쪽에 동일하게 선언해서 정확히 감지한다.
// (2026년 9월 기준 크롬 Prompt API는 en/ja/es/de/fr만 공식 지원 — 한국어는 아직 없음)
const KOREAN_TEXT = { type: "text" as const, languages: ["ko"] };

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

export function useLanguageModel(): UseLanguageModelResult {
  const [state, setState] = useState<AvailabilityState>("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const sessionRef = useRef<LanguageModelSession | null>(null);
  const creatingRef = useRef<Promise<LanguageModelSession | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (typeof window === "undefined" || !window.LanguageModel) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const availability = await window.LanguageModel.availability({
          expectedInputs: [KOREAN_TEXT],
          expectedOutputs: [KOREAN_TEXT],
        });
        if (cancelled) return;
        if (availability === "unavailable") setState("unsupported");
        else setState(availability);
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
          initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
          expectedInputs: [KOREAN_TEXT],
          expectedOutputs: [KOREAN_TEXT],
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
        setState("available");
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

  const ask = useCallback(
    async (message: string, campaigns: CampaignSnapshot[]): Promise<AskResult> => {
      const canUseOnDevice = state !== "unsupported" && state !== "error" && !!window.LanguageModel;
      const mockFallback = () => ({ reply: mockAssistantReply(message, campaigns), engine: "preview" as EngineKind });

      if (canUseOnDevice) {
        try {
          const onDevice = (async () => {
            const session = await ensureSession();
            if (!session) {
              console.warn("[assistant] 온디바이스 세션 생성 실패 (ensureSession()이 null 반환)");
              return null;
            }
            const raw = await session.prompt(buildUserTurn(message, snapshotsToPromptJson(campaigns)), {
              responseConstraint: ASSISTANT_RESPONSE_SCHEMA,
            });
            const parsed = safeParseReply(raw);
            if (!parsed) console.warn("[assistant] 온디바이스 응답 파싱 실패, 원본 응답:", raw);
            return parsed;
          })();
          // 모델 다운로드가 안 끝났거나 응답이 지연되면 오래 기다리지 않고 다음 단계로 넘어간다.
          const timeout = new Promise<null>((resolve) =>
            setTimeout(() => {
              console.warn("[assistant] 온디바이스 응답 6초 타임아웃");
              resolve(null);
            }, 6000)
          );
          const parsed = await Promise.race([onDevice, timeout]);
          if (parsed) return { reply: parsed, engine: "on-device" };
        } catch (err) {
          console.warn("[assistant] 온디바이스 호출 중 에러, 클라우드로 폴백:", err);
        }
      }

      // Firefox/Safari처럼 온디바이스 모델이 없거나 응답에 실패한 경우, 서버를 거쳐 Gemini로 폴백한다.
      try {
        const cloud = fetchGeminiReply(message, campaigns);
        // Gemini 쪽에서 과부하 재시도가 있을 수 있어 온디바이스보다 여유 있게 기다린다.
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000));
        const parsed = await Promise.race([cloud, timeout]);
        if (parsed) return { reply: parsed, engine: "cloud" };
        console.warn("[assistant] 클라우드(Gemini) 응답 없음, 미리보기로 폴백");
      } catch (err) {
        console.warn("[assistant] 클라우드(Gemini) 호출 중 에러, 미리보기로 폴백:", err);
      }

      return mockFallback();
    },
    [ensureSession, state]
  );

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
    };
  }, []);

  const engine: EngineKind = state === "available" ? "on-device" : "preview";

  return { state, engine, downloadProgress, ask };
}
