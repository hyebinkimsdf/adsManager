"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { OnDeviceAiRuntime } from "@/lib/ai/onDeviceAiRuntime";
import { TRACKING_RULES_SYSTEM_PROMPT_EN } from "@/lib/ai/trackingRulesPrompt";
import { ON_DEVICE_AI_PROMPTS } from "@/lib/ai/onDeviceAiPrompts";

const AiContext = createContext<OnDeviceAiRuntime | null>(null);

export function OnDeviceAiProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 새 광고 설정은 검증된 기본값과 서버 추천을 사용하며 Nano를 호출하지 않는다.
  const featurePrompt = pathname === "/tracking" ? TRACKING_RULES_SYSTEM_PROMPT_EN : null;
  const [runtime] = useState(() => new OnDeviceAiRuntime(ON_DEVICE_AI_PROMPTS));
  useEffect(() => {
    void runtime.start();
    return () => runtime.dispose();
  }, [runtime]);
  useEffect(() => {
    runtime.setActiveFeature(featurePrompt);
  }, [runtime, featurePrompt]);
  useEffect(() => {
    // 최초 제스처가 availability 확인보다 빨라도, 이후 제스처에서 활성화 대기를 풀 수 있다.
    const events = ["click", "keydown"] as const;
    const retry = () => {
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      runtime.retryStalled();
    };
    events.forEach((type) => document.addEventListener(type, retry, { capture: true }));
    return () => events.forEach((type) => document.removeEventListener(type, retry, true));
  }, [runtime]);
  return <AiContext.Provider value={runtime}>{children}</AiContext.Provider>;
}

export function useAiPreparation() {
  const runtime = useContext(AiContext);
  if (!runtime) throw new Error("useAiPreparation requires OnDeviceAiProvider");
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getServerSnapshot);
  return { ...snapshot, prepare: runtime.prepare, runtime };
}
