"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CAMPAIGN_DRAFT_SYSTEM_PROMPT_EN, buildCampaignDraftUserTurnEn } from "./campaignDraftPrompt";
import { CAMPAIGN_DRAFT_RESPONSE_SCHEMA_EN, isCampaignDraftSuggestion, type CampaignDraftSuggestion } from "./campaignDraftSchema";
import { suggestCampaignDraft } from "./campaignDraftHeuristics";
import { fetchCampaignDraft } from "./campaignDraftClient";
import { checkTranslatorAvailability, createTranslator, type TranslatorAvailability } from "./translator";
import type { EngineKind } from "./types";
import type { LanguageModelSession, TranslatorSession } from "./global";

// 캠페인 초안 생성도 채팅 어시스턴트(useLanguageModel)와 같은 온디바이스 우회 경로를 쓴다:
// 크롬 Prompt API가 아직 한국어를 지원하지 않아 영어로 생성한 뒤 Translator API로 되돌린다.
const EN_TEXT = { type: "text" as const, languages: ["en"] };

interface Translators {
  toEn: TranslatorSession;
  toKo: TranslatorSession;
}

export type AvailabilityState = "checking" | "unsupported" | "downloadable" | "downloading" | "available" | "error";

export interface CampaignDraftResult {
  draft: CampaignDraftSuggestion;
  engine: EngineKind;
}

interface UseCampaignDraftResult {
  state: AvailabilityState;
  downloadProgress: number;
  generate: (description: string) => Promise<CampaignDraftResult>;
}

function worstOf(a: TranslatorAvailability, b: TranslatorAvailability): TranslatorAvailability {
  const rank: Record<TranslatorAvailability, number> = { unavailable: 0, downloadable: 1, downloading: 2, available: 3 };
  return rank[a] <= rank[b] ? a : b;
}

export function useCampaignDraft(): UseCampaignDraftResult {
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
          window.LanguageModel.availability({ expectedInputs: [EN_TEXT], expectedOutputs: [EN_TEXT] }),
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
          initialPrompts: [{ role: "system", content: CAMPAIGN_DRAFT_SYSTEM_PROMPT_EN }],
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
        const [toEn, toKo] = await Promise.all([createTranslator("ko", "en", onProgress), createTranslator("en", "ko", onProgress)]);
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

  const generate = useCallback(
    async (description: string): Promise<CampaignDraftResult> => {
      const canUseOnDevice = state !== "unsupported" && state !== "error" && !!window.LanguageModel && !!window.Translator;

      if (canUseOnDevice) {
        try {
          const onDevice = (async () => {
            const [session, translators] = await Promise.all([ensureSession(), ensureTranslators()]);
            if (!session || !translators) {
              console.warn("[campaign-draft] 온디바이스 세션/번역기 준비 실패");
              return null;
            }

            const englishDescription = await translators.toEn.translate(description);
            const raw = await session.prompt(buildCampaignDraftUserTurnEn(englishDescription), {
              responseConstraint: CAMPAIGN_DRAFT_RESPONSE_SCHEMA_EN,
            });
            const parsedEn = JSON.parse(raw);
            if (!isCampaignDraftSuggestion(parsedEn)) {
              console.warn("[campaign-draft] 온디바이스 응답 형식 불일치, 원본 응답:", raw);
              return null;
            }

            const [name, reasoning] = await Promise.all([
              translators.toKo.translate(parsedEn.name),
              translators.toKo.translate(parsedEn.reasoning),
            ]);

            const draft: CampaignDraftSuggestion = { ...parsedEn, name, reasoning };
            setState("available");
            return draft;
          })();
          let timeoutId: ReturnType<typeof setTimeout>;
          const timeout = new Promise<null>((resolve) => {
            timeoutId = setTimeout(() => {
              console.warn("[campaign-draft] 온디바이스 응답 9초 타임아웃");
              resolve(null);
            }, 9000);
          });
          const draft = await Promise.race([onDevice, timeout]);
          clearTimeout(timeoutId!);
          if (draft) return { draft, engine: "on-device" };
        } catch (err) {
          console.warn("[campaign-draft] 온디바이스 호출 중 에러, 클라우드로 폴백:", err);
        }
      }

      try {
        const cloud = fetchCampaignDraft(description);
        let timeoutId: ReturnType<typeof setTimeout>;
        const timeout = new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => resolve(null), 12000);
        });
        const draft = await Promise.race([cloud, timeout]);
        clearTimeout(timeoutId!);
        if (draft) return { draft, engine: "cloud" };
        console.warn("[campaign-draft] 클라우드(Gemini) 응답 없음, 규칙 기반으로 폴백");
      } catch (err) {
        console.warn("[campaign-draft] 클라우드(Gemini) 호출 중 에러, 규칙 기반으로 폴백:", err);
      }

      return { draft: suggestCampaignDraft(description), engine: "preview" };
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

  return { state, downloadProgress, generate };
}
