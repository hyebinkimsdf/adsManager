/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { HiOutlineArrowTrendingDown, HiOutlineArrowTrendingUp } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatPercent } from "@/lib/format";
import type { RoasBucket } from "@/lib/insights";

const TONE: Record<RoasBucket["key"], { bg: string; label: string }> = {
  good: { bg: "var(--color-green-50)", label: "var(--color-green-600)" },
  okay: { bg: "var(--color-yellow-50)", label: "var(--color-yellow-600)" },
  bad: { bg: "var(--color-red-50)", label: "var(--color-red-500)" },
};

export function SimpleRoasStatusCards({ buckets }: { buckets: RoasBucket[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>전체 광고 성과는 어떤가요?</CardTitle>
      </CardHeader>
      <div
        css={css`
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          @media (min-width: 640px) {
            grid-template-columns: repeat(3, 1fr);
          }
        `}
      >
        {buckets.map((b) => (
          <div
            key={b.key}
            css={css`
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.5rem;
              border-radius: var(--radius-lg);
              padding: 1.25rem;
              text-align: center;
            `}
            style={{ backgroundColor: TONE[b.key].bg }}
          >
            <span css={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">
              {b.emoji}
            </span>
            <p css={{ fontSize: 17, fontWeight: 700 }} style={{ color: TONE[b.key].label }}>
              {b.label}
            </p>
            <p css={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-600)" }}>{b.description}</p>
            <div
              css={css`
                margin-top: 0.25rem;
                width: 100%;
                border-radius: var(--radius-md);
                background: white;
                padding: 0.75rem 1rem;
                box-shadow: var(--shadow-card);
              `}
            >
              <p css={{ fontSize: 12, color: "var(--color-gray-500)" }}>평균 ROAS</p>
              <p
                css={{
                  marginTop: "0.125rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.25rem",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--color-gray-900)",
                }}
              >
                {b.count > 0 ? formatPercent(b.avgRoas, 0) : "-"}
                {b.count > 0 && b.key === "good" && (
                  <HiOutlineArrowTrendingUp style={{ height: "1rem", width: "1rem", color: "var(--color-green-600)" }} aria-hidden="true" />
                )}
                {b.count > 0 && b.key === "bad" && (
                  <HiOutlineArrowTrendingDown style={{ height: "1rem", width: "1rem", color: "var(--color-red-500)" }} aria-hidden="true" />
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
