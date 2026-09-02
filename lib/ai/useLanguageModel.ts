"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SYSTEM_PROMPT, buildUserTurn } from "./systemPrompt";
import { ASSISTANT_RESPONSE_SCHEMA } from "./schema";
import { mockAssistantReply } from "./mockAssistant";
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
          initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
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
      const fallback = () => ({ reply: mockAssistantReply(message, campaigns), engine: "preview" as EngineKind });
      if (!canUseOnDevice) {
        return fallback();
      }
      try {
        const onDevice = (async () => {
          const session = await ensureSession();
          if (!session) return null;
          const raw = await session.prompt(buildUserTurn(message, snapshotsToPromptJson(campaigns)), {
            responseConstraint: ASSISTANT_RESPONSE_SCHEMA,
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

  const engine: EngineKind = state === "available" ? "on-device" : "preview";

  return { state, engine, downloadProgress, ask };
}
