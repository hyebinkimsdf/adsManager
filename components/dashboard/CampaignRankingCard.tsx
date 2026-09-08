/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { rankCampaignsByMetric, type RankMetric } from "@/lib/insights";
import type { Campaign } from "@/lib/mock/types";

const TABS: { key: RankMetric; label: string }[] = [
  { key: "spend", label: "광고비" },
  { key: "conversions", label: "문의" },
  { key: "conversionRate", label: "전환율" },
];

const MAX_ROWS = 4;

export function CampaignRankingCard({ campaigns }: { campaigns: Campaign[] }) {
  const [metric, setMetric] = useState<RankMetric>("conversions");
  const rows = rankCampaignsByMetric(campaigns, metric).slice(0, MAX_ROWS);
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <Card>
      <p css={{ marginBottom: "0.75rem", fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>
        최근 7일 캠페인 성과
      </p>

      <div
        role="tablist"
        aria-label="캠페인 성과 지표 선택"
        css={css`
          display: inline-flex;
          margin-bottom: 1rem;
          border-radius: 9999px;
          background-color: var(--color-gray-100);
          padding: 0.1875rem;
        `}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={metric === tab.key}
            onClick={() => setMetric(tab.key)}
            css={css`
              border-radius: 9999px;
              padding: 0.3125rem 0.75rem;
              font-size: 12.5px;
              font-weight: 600;
              transition: background-color 150ms, color 150ms;
              background-color: ${metric === tab.key ? "white" : "transparent"};
              color: ${metric === tab.key ? "var(--color-blue-600)" : "var(--color-gray-500)"};
              box-shadow: ${metric === tab.key ? "0 1px 2px rgba(0,0,0,0.05)" : "none"};

              &:hover {
                color: var(--color-blue-600);
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p css={{ fontSize: 13, color: "var(--color-gray-400)" }}>표시할 캠페인 데이터가 없어요.</p>
      ) : (
        <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {rows.map((row, i) => (
            <Link key={row.campaignId} href={`/campaigns/${row.campaignId}`} css={{ display: "block" }}>
              <div css={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span css={{ width: "1rem", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--color-gray-400)" }}>
                  {i + 1}
                </span>
                <div css={{ minWidth: 0, flex: 1 }}>
                  <div css={{ marginBottom: "0.25rem", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span
                      css={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--color-gray-800)",
                      }}
                    >
                      {row.name}
                    </span>
                    <span css={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: "var(--color-gray-600)" }}>
                      {row.displayValue}
                    </span>
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
                        background-color: ${i === 0 ? "var(--color-blue-500)" : "var(--color-gray-300)"};
                      `}
                      style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
