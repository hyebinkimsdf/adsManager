/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useUiMode, setUiMode } from "@/lib/ui/mode";

const segmentStyle = (active: boolean) => css`
  flex: 1;
  white-space: nowrap;
  border-radius: 9999px;
  padding: 0.375rem 0.625rem;
  font-size: 12px;
  font-weight: 500;
  transition: color 150ms, background-color 150ms;
  background-color: ${active ? "white" : "transparent"};
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-500)"};
  box-shadow: ${active ? "0 1px 2px rgba(0,0,0,0.05)" : "none"};

  ${!active &&
  `
    &:hover {
      color: var(--color-gray-700);
    }
  `}
`;

export function ModeToggle() {
  const mode = useUiMode();

  return (
    <div
      role="group"
      aria-label="화면 모드 선택"
      css={css`
        display: inline-flex;
        align-items: center;
        border-radius: 9999px;
        background-color: var(--color-gray-100);
        padding: 0.25rem;
      `}
    >
      <button type="button" aria-pressed={mode === "simple"} onClick={() => setUiMode("simple")} css={segmentStyle(mode === "simple")}>
        🙂 간편
      </button>
      <button type="button" aria-pressed={mode === "expert"} onClick={() => setUiMode("expert")} css={segmentStyle(mode === "expert")}>
        ⚙️ 전문가
      </button>
    </div>
  );
}
