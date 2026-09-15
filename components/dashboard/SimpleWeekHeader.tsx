/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { HiOutlineCalendarDays, HiOutlineBell } from "react-icons/hi2";
import { formatDateRange } from "@/lib/format";

const GREETING_NAME = "김혜빈";

export function SimpleWeekHeader({
  healthy,
  subtitle,
  rangeStart,
  rangeEnd,
}: {
  healthy: boolean;
  subtitle: string;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          @media (min-width: 640px) {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        `}
      >
        <p css={{ fontSize: 14, fontWeight: 600, color: "var(--color-gray-700)" }}>
          안녕하세요, {GREETING_NAME}님! 👋
        </p>

        <div css={{ display: "flex", flexShrink: 0, alignItems: "center", gap: "0.625rem" }}>
          <div
            css={css`
              display: none;
              align-items: center;
              gap: 0.5rem;
              border-radius: var(--radius-md);
              background: white;
              padding: 0.5rem 0.875rem;
              font-size: 13px;
              font-weight: 500;
              color: var(--color-gray-700);
              box-shadow: var(--shadow-card);
              @media (min-width: 480px) {
                display: inline-flex;
              }
            `}
          >
            <HiOutlineCalendarDays style={{ height: "1rem", width: "1rem", color: "var(--color-gray-400)" }} aria-hidden="true" />
            {formatDateRange(rangeStart, rangeEnd)}
          </div>

          <span
            css={css`
              display: flex;
              height: 2.25rem;
              width: 2.25rem;
              flex-shrink: 0;
              align-items: center;
              justify-content: center;
              border-radius: 9999px;
              background: white;
              color: var(--color-gray-600);
              box-shadow: var(--shadow-card);
            `}
            aria-hidden="true"
          >
            <HiOutlineBell style={{ height: "1.125rem", width: "1.125rem" }} />
          </span>

          <span
            css={css`
              display: flex;
              height: 2.25rem;
              width: 2.25rem;
              flex-shrink: 0;
              align-items: center;
              justify-content: center;
              border-radius: 9999px;
              background-color: var(--color-blue-600);
              font-size: 13px;
              font-weight: 700;
              color: white;
            `}
            aria-hidden="true"
          >
            {GREETING_NAME[0]}
          </span>
        </div>
      </div>

      <div>
        <h1
          css={css`
            font-size: 22px;
            font-weight: 700;
            line-height: 1.4;
            color: var(--color-gray-900);
            @media (min-width: 640px) {
              font-size: 26px;
            }
          `}
        >
          {healthy ? (
            <>
              지난 7일, 광고가 <span css={{ color: "var(--color-blue-600)" }}>잘</span> 운영되고 있어요.
            </>
          ) : (
            <>
              지난 7일, <span css={{ color: "var(--color-blue-600)" }}>점검이 필요해요.</span>
            </>
          )}
        </h1>
        <p css={{ marginTop: "0.375rem", fontSize: 13, color: "var(--color-gray-600)" }}>{subtitle}</p>
      </div>
    </div>
  );
}
