"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KEYWORD_SYSTEM_PROMPT, buildKeywordUserTurn, type KeywordPromptInput } from "./keywordPrompt";
import { KEYWORD_RESPONSE_SCHEMA } from "./keywordSchema";
import { mockKeywordSuggestions } from "./mockKeywordAssistant";
import { fetchNaverKeywordSuggestions } from "./naverKeywordClient";
import type { EngineKind, KeywordSuggestionReply } from "./types";
import type { LanguageModelSession } from "./global";
import type { AvailabilityState } from "./useLanguageModel";

export interface KeywordSuggestResult {
  reply: KeywordSuggestionReply;
  engine: EngineKind;
}

export interface KeywordSuggestOptions {
  /** 요청할 키워드 개수. 네이버 API 실데이터일 때만 유의미하며, 온디바이스/미리보기 폴백에는 적용되지 않는다. */
  limit?: number;
}

interface UseKeywordAssistantResult {
  state: AvailabilityState;
  downloadProgress: number;
  suggest: (input: KeywordPromptInput, options?: KeywordSuggestOptions) => Promise<KeywordSuggestResult>;
}

function safeParseReply(raw: string): KeywordSuggestionReply | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.keywords)) {
      return parsed as KeywordSuggestionReply;
    }
    return null;
  } catch {
    return null;
  }
}

export function useKeywordAssistant(): UseKeywordAssistantResult {
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
        const availability = await window.LanguageModel.availability();
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
          initialPrompts: [{ role: "system", content: KEYWORD_SYSTEM_PROMPT }],
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

  const suggest = useCallback(
    async (input: KeywordPromptInput, options?: KeywordSuggestOptions): Promise<KeywordSuggestResult> => {
      // 실제 월간 검색수·경쟁정도 데이터가 있는 네이버 검색광고 API를 최우선으로 시도한다.
      const naverKeywords = await fetchNaverKeywordSuggestions(input, options);
      if (naverKeywords && naverKeywords.length > 0) {
        return { reply: { keywords: naverKeywords }, engine: "naver-ads" };
      }

      const canUseOnDevice = state !== "unsupported" && state !== "error" && !!window.LanguageModel;
      const fallback = () => ({ reply: mockKeywordSuggestions(input), engine: "preview" as EngineKind });
      if (!canUseOnDevice) {
        return fallback();
      }
      try {
        const onDevice = (async () => {
          const session = await ensureSession();
          if (!session) return null;
          const raw = await session.prompt(buildKeywordUserTurn(input), {
            responseConstraint: KEYWORD_RESPONSE_SCHEMA,
          });
          return safeParseReply(raw);
        })();
        // 모델 다운로드가 안 끝났거나 응답이 지연되면 오래 기다리지 않고 미리보기 응답으로 넘어간다.
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
        const parsed = await Promise.race([onDevice, timeout]);
        if (parsed) return { reply: parsed, engine: "on-device" };
        return fallback();
      } catch {
        return fallback();
      }
    },
    [ensureSession, state]
  );

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
    };
  }, []);

  return { state, downloadProgress, suggest };
}
