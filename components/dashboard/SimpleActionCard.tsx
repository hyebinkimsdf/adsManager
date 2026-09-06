/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { applyAction } from "@/lib/ai/applyAction";
import type { SimpleAction } from "@/lib/insights";

export function SimpleActionCard({ item }: { item: SimpleAction }) {
  const [applied, setApplied] = useState(false);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
        border-radius: var(--radius-lg);
        background: white;
        padding: 1rem;
        box-shadow: var(--shadow-card);

        @media (min-width: 640px) {
          flex-direction: row;
          align-items: center;
        }
      `}
    >
      <span css={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">
        {item.emoji}
      </span>
      <div css={{ minWidth: 0, flex: 1 }}>
        <p css={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)" }}>{item.title}</p>
        <p css={{ marginTop: "0.125rem", fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-500)" }}>
          {item.detail}
        </p>
      </div>
      {applied ? (
        <span css={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: "var(--color-green-600)" }}>
          완료했어요 ✅
        </span>
      ) : (
        <Button
          size="md"
          css={css`
            width: 100%;
            flex-shrink: 0;
            @media (min-width: 640px) {
              width: auto;
            }
          `}
          onClick={() => {
            applyAction(item.action);
            setApplied(true);
          }}
        >
          🤖 AI에게 맡기기
        </Button>
      )}
    </div>
  );
}
