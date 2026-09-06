/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { Badge } from "@/components/ui/Badge";
import type { AvailabilityState } from "@/lib/ai/useLanguageModel";

const rowStyle = css`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0 0.25rem 0.5rem;
  font-size: 12px;
  color: var(--color-gray-500);
`;

export function AvailabilityBanner({
  state,
  downloadProgress,
}: {
  state: AvailabilityState;
  downloadProgress: number;
}) {
  if (state === "available") {
    return (
      <div css={rowStyle}>
        <Badge tone="green">온디바이스 AI</Badge>
        <span>이 브라우저에서 로컬로 실행돼요</span>
      </div>
    );
  }
  if (state === "downloading" || state === "downloadable") {
    return (
      <div css={rowStyle}>
        <Badge tone="blue">AI 준비 중</Badge>
        <span>{state === "downloading" ? `모델을 내려받는 중이에요 · ${downloadProgress}%` : "첫 메시지를 보내면 모델을 준비해요"}</span>
      </div>
    );
  }
  return (
    <div css={rowStyle}>
      <Badge tone="gray">미리보기 모드</Badge>
      <span>이 브라우저에서는 예시 응답으로 대화 흐름을 보여드려요</span>
    </div>
  );
}
