/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";

export function WizardProgressBar({ index, total, label }: { index: number; total: number; label: string }) {
  const percent = total <= 1 ? 100 : (index / (total - 1)) * 100;

  return (
    <div>
      <div css={{ marginBottom: "0.5rem", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
        <span css={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-blue-600)" }}>
          STEP {index + 1} / {total}
        </span>
        <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-700)" }}>{label}</span>
      </div>
      <div
        css={css`
          height: 0.375rem;
          overflow: hidden;
          border-radius: 9999px;
          background-color: var(--color-gray-100);
        `}
      >
        <div
          css={css`
            height: 100%;
            border-radius: 9999px;
            background-color: var(--color-blue-500);
            transition: width 250ms ease;
          `}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
