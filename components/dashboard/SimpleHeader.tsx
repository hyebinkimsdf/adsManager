/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";

function Mascot() {
  return (
    <div
      css={css`
        position: relative;
        height: 3.5rem;
        width: 3.5rem;
        flex-shrink: 0;
        border-radius: 9999px;
        background: white;
        box-shadow: var(--shadow-card);
      `}
    >
      <span
        css={css`
          position: absolute;
          left: 24%;
          top: 38%;
          height: 0.375rem;
          width: 0.375rem;
          border-radius: 9999px;
          background-color: var(--color-gray-900);
        `}
      />
      <span
        css={css`
          position: absolute;
          right: 24%;
          top: 38%;
          height: 0.375rem;
          width: 0.375rem;
          border-radius: 9999px;
          background-color: var(--color-gray-900);
        `}
      />
      <span
        css={css`
          position: absolute;
          bottom: 22%;
          left: 50%;
          height: 0.5rem;
          width: 0.5rem;
          transform: translateX(-50%);
          border-radius: 9999px;
          background-color: var(--color-blue-500);
        `}
      />
    </div>
  );
}

export function SimpleHeader() {
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
          AI가 알아서 <span css={{ color: "var(--color-blue-600)" }}>광고 세팅</span>을 도와드려요
        </h1>
        <p css={{ marginTop: "0.375rem", fontSize: 13, color: "var(--color-gray-500)" }}>
          목표만 알려주시면 AI가 최적의 광고 설정을 제안해 드려요.
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
          오늘은 어떤 목표로
          <br />
          광고를 진행할까요? 😊
        </div>
        <Mascot />
      </div>
    </div>
  );
}
