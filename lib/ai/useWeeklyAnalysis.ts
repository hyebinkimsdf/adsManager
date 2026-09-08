"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WEEKLY_ANALYSIS_SYSTEM_PROMPT, buildWeeklyAnalysisUserTurn, type WeeklyCampaignInput } from "./weeklyAnalysisPrompt";
import { WEEKLY_ANALYSIS_RESPONSE_SCHEMA, type WeeklyAnalysisReply } from "./weeklyAnalysisSchema";
import { fetchWeeklyAnalysisReply } from "./weeklyAnalysisClient";
import type { EngineKind } from "./types";
import type { LanguageModelSession } from "./global";
import type { AvailabilityState } from "./useLanguageModel";

export interface WeeklyAnalysisResult {
  reply: WeeklyAnalysisReply;
  engine: EngineKind;
}

interface UseWeeklyAnalysisResult {
  state: AvailabilityState;
  downloadProgress: number;
  /** 실제 AI로 분석을 시도한다. 온디바이스·클라우드 모두 실패하면 null을 반환하고,
   *  호출한 쪽에서 규칙 기반 폴백(lib/insights.ts)을 쓰도록 한다. */
  analyze: (campaigns: WeeklyCampaignInput[]) => Promise<WeeklyAnalysisResult | null>;
}

function safeParseReply(raw: string): WeeklyAnalysisReply | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.recommendations) && Array.isArray(parsed.spotlights)) {
      return parsed as WeeklyAnalysisReply;
    }
    return null;
  } catch {
    return null;
  }
}

export function useWeeklyAnalysis(): UseWeeklyAnalysisResult {
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
          initialPrompts: [{ role: "system", content: WEEKLY_ANALYSIS_SYSTEM_PROMPT }],
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

  const analyze = useCallback(
    async (campaigns: WeeklyCampaignInput[]): Promise<WeeklyAnalysisResult | null> => {
      const canUseOnDevice = state !== "unsupported" && state !== "error" && !!window.LanguageModel;

      if (canUseOnDevice) {
        try {
          const onDevice = (async () => {
            const session = await ensureSession();
            if (!session) return null;
            const raw = await session.prompt(buildWeeklyAnalysisUserTurn(campaigns), {
              responseConstraint: WEEKLY_ANALYSIS_RESPONSE_SCHEMA,
            });
            return safeParseReply(raw);
          })();
          let timeoutId: ReturnType<typeof setTimeout>;
          const timeout = new Promise<null>((resolve) => {
            timeoutId = setTimeout(() => resolve(null), 6000);
          });
          const parsed = await Promise.race([onDevice, timeout]);
          clearTimeout(timeoutId!);
          if (parsed) return { reply: parsed, engine: "on-device" };
        } catch {
          // 온디바이스 실패 시 클라우드로 폴백
        }
      }

      try {
        const cloud = fetchWeeklyAnalysisReply(campaigns);
        let timeoutId: ReturnType<typeof setTimeout>;
        const timeout = new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => resolve(null), 12000);
        });
        const parsed = await Promise.race([cloud, timeout]);
        clearTimeout(timeoutId!);
        if (parsed) return { reply: parsed, engine: "cloud" };
      } catch {
        // 클라우드도 실패하면 호출한 쪽이 규칙 기반 폴백을 쓰도록 null 반환
      }

      return null;
    },
    [ensureSession, state]
  );

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
    };
  }, []);

  return { state, downloadProgress, analyze };
}
