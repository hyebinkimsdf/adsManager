/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import { HiOutlineSparkles, HiViewfinderCircle, HiSparkles, HiCheck } from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { addKeywords, adjustBudgetByPercent } from "@/lib/mock/store";
import { sumHistory } from "@/lib/mock/campaigns";
import { INDUSTRY_TAILS } from "@/lib/ai/keywordHeuristics";
import type { Campaign } from "@/lib/mock/types";

interface Recommendation {
  id: string;
  icon: IconType;
  iconBg: string;
  iconColor: string;
  label: string;
  detail: string;
  run: (campaigns: Campaign[]) => void;
}

function suggestKeywordsFor(campaign: Campaign): string[] {
  const tails = INDUSTRY_TAILS[campaign.industry] ?? INDUSTRY_TAILS.etc;
  return tails
    .map((tail) => `${campaign.name} ${tail}`)
    .filter((k) => !campaign.targeting.keywords.includes(k))
    .slice(0, 3);
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "precise-setup",
    icon: HiViewfinderCircle,
    iconBg: "var(--color-blue-50)",
    iconColor: "var(--color-blue-600)",
    label: "더 정확한 광고 세팅하기",
    detail: "AI가 키워드, 타겟, 예산을 분석해 성과를 높여드려요.",
    run: (campaigns) => {
      for (const c of campaigns) {
        if (c.status !== "active" || c.targeting.keywords.length >= 3) continue;
        const suggestions = suggestKeywordsFor(c);
        if (suggestions.length > 0) addKeywords(c.id, suggestions);
      }
    },
  },
  {
    id: "efficiency",
    icon: HiSparkles,
    iconBg: "var(--color-green-50)",
    iconColor: "var(--color-green-600)",
    label: "광고 효율 높이기",
    detail: "불필요한 지출은 줄이고 효율은 높이는 방법이에요.",
    run: (campaigns) => {
      const active = campaigns.filter((c) => c.status === "active");
      if (active.length === 0) return;
      const worst = [...active].sort(
        (a, b) => sumHistory(a.history).roas - sumHistory(b.history).roas
      )[0];
      adjustBudgetByPercent(worst.id, -15);
    },
  },
];

export function SimpleQuickActions({ campaigns }: { campaigns: Campaign[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const hasActive = campaigns.some((c) => c.status === "active");

  if (!hasActive) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <HiOutlineSparkles style={{ height: "1rem", width: "1rem", color: "var(--color-blue-500)" }} aria-hidden="true" />
          AI 맞춤 추천
        </CardTitle>
      </CardHeader>
      <div
        css={css`
          display: flex;
          flex-direction: column;

          & > div + div {
            border-top: 1px solid var(--border-subtle);
          }
        `}
      >
        {RECOMMENDATIONS.map((r, i) => {
          const isDone = done[r.id];
          const Icon = r.icon;
          return (
            <div
              key={r.id}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.875rem 0;
                ${i === 0 && "padding-top: 0;"}
                ${i === RECOMMENDATIONS.length - 1 && "padding-bottom: 0;"}
              `}
            >
              <span
                css={{
                  display: "flex",
                  height: "2.5rem",
                  width: "2.5rem",
                  flexShrink: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "9999px",
                  backgroundColor: r.iconBg,
                }}
              >
                <Icon style={{ height: "1.25rem", width: "1.25rem", color: r.iconColor }} aria-hidden="true" />
              </span>
              <div css={{ minWidth: 0, flex: 1 }}>
                <p css={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)" }}>{r.label}</p>
                <p css={{ marginTop: "0.125rem", fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-500)" }}>
                  {r.detail}
                </p>
              </div>
              <button
                type="button"
                disabled={isDone}
                onClick={() => {
                  r.run(campaigns);
                  setDone((prev) => ({ ...prev, [r.id]: true }));
                }}
                css={css`
                  flex-shrink: 0;
                  border-radius: 9999px;
                  padding: 0.5rem 0.875rem;
                  font-size: 13px;
                  font-weight: 600;
                  transition: background-color 150ms;
                  background-color: ${isDone ? "var(--color-green-50)" : "var(--color-blue-50)"};
                  color: ${isDone ? "var(--color-green-600)" : "var(--color-blue-600)"};

                  &:hover {
                    background-color: ${isDone ? "var(--color-green-50)" : "var(--color-blue-100)"};
                  }
                `}
              >
                {isDone ? (
                  <span css={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <HiCheck style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 적용 완료
                  </span>
                ) : (
                  "추천 받기"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
