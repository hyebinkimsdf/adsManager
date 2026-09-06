/** @jsxImportSource @emotion/react */
"use client";

import { css, keyframes } from "@emotion/react";

const pulseDot = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
`;

export function SimpleSummaryHeader() {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
        @media (min-width: 640px) {
          flex-direction: row;
          align-items: flex-start;
          justify-content: space-between;
        }
      `}
    >
      <div>
        <h1
          css={css`
            font-size: 20px;
            font-weight: 700;
            line-height: 1.375;
            color: var(--color-gray-900);
            @media (min-width: 640px) {
              font-size: 24px;
            }
          `}
        >
          AI가 광고를 <span css={{ color: "var(--color-blue-600)" }}>잘 관리</span>하고 있어요!
        </h1>
        <p css={{ marginTop: "0.375rem", fontSize: 13, color: "var(--color-gray-500)" }}>
          현재 상태를 한눈에 확인하고, 더 좋은 결과를 만들어보세요.
        </p>
      </div>
      <div
        css={css`
          display: none;
          @media (min-width: 640px) {
            display: flex;
            align-items: flex-end;
            gap: 0.75rem;
          }
        `}
      >
        <div
          css={css`
            border-radius: var(--radius-md);
            background: white;
            padding: 0.75rem 1rem;
            font-size: 13px;
            font-weight: 500;
            line-height: 1.6;
            color: var(--color-gray-800);
            box-shadow: var(--shadow-card);
          `}
        >
          걱정 마세요!
          <br />
          AI가 최적의 상태로
          <br />
          관리하고 있어요 😊
        </div>
        <div
          css={css`
            position: relative;
            display: flex;
            height: 4rem;
            width: 4rem;
            flex-shrink: 0;
            align-items: center;
            justify-content: center;
            border-radius: 9999px;
            background: white;
            font-size: 32px;
            box-shadow: var(--shadow-card);
          `}
          aria-hidden="true"
        >
          🤖
          <span
            css={css`
              position: absolute;
              right: -0.25rem;
              top: -0.25rem;
              font-size: 14px;
              animation: ${pulseDot} 1.1s ease-in-out infinite;
            `}
          >
            ✨
          </span>
        </div>
      </div>
    </div>
  );
}
