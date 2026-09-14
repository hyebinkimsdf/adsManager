/** @jsxImportSource @emotion/react */
"use client";

import { Badge } from "@/components/ui/Badge";
import type { EngineKind } from "@/lib/ai/types";

const ENGINE_LABEL: Record<EngineKind, string> = {
  "on-device": "나노가 만든 답변",
  preview: "기본 처리 · 나노 미사용",
};

const ENGINE_TONE: Record<EngineKind, "blue" | "gray" | "green"> = {
  "on-device": "blue",
  preview: "gray",
};

/** 이 카드의 추천이 실제 AI 분석 결과인지, AI를 못 써서 규칙 기반으로 대신 채운 것인지 정직하게 표시한다. */
export function EngineBadge({ engine, analyzing }: { engine: EngineKind | null; analyzing?: boolean }) {
  if (analyzing) return <Badge tone="gray">AI 분석 중...</Badge>;
  if (!engine) return null;
  return <Badge tone={ENGINE_TONE[engine]}>{ENGINE_LABEL[engine]}</Badge>;
}
