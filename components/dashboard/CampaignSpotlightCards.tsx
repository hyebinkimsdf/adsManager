/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import Link from "next/link";
import {
  HiTrophy,
  HiArrowTrendingUp,
  HiArrowTrendingDown,
  HiExclamationTriangle,
  HiBolt,
  HiSparkles,
  HiChevronRight,
  HiArrowPath,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LineChart } from "@/components/dashboard/LineChart";
import { EngineBadge } from "@/components/dashboard/EngineBadge";
import { adjustBudgetByPercent } from "@/lib/mock/store";
import { formatSignedPercent } from "@/lib/format";
import type { CampaignSpotlight } from "@/lib/insights";
import type { EngineKind } from "@/lib/ai/types";

type ApplyState = "idle" | "pending" | "done" | "error";

const TAG_CONFIG: Record<CampaignSpotlight["tag"], { icon: IconType; label: string; bg: string; color: string }> = {
  best: { icon: HiTrophy, label: "가장 잘하고 있어요", bg: "var(--color-green-50)", color: "var(--color-green-600)" },
  rising: { icon: HiArrowTrendingUp, label: "더 키워볼 만해요", bg: "var(--color-blue-50)", color: "var(--color-blue-600)" },
  watch: { icon: HiExclamationTriangle, label: "개선이 필요해요", bg: "var(--color-red-50)", color: "var(--color-red-500)" },
};

function SpotlightAction({ spotlight }: { spotlight: CampaignSpotlight }) {
  const [state, setState] = useState<ApplyState>("idle");

  if (spotlight.tag === "best") {
    return (
      <Link href={`/campaigns/${spotlight.campaignId}`} css={{ display: "block", width: "100%" }}>
        <Button size="md" variant="secondary" css={{ width: "100%" }}>
          자세히 보기 <HiChevronRight style={{ height: "0.875rem", width: "0.875rem", marginLeft: 2 }} aria-hidden="true" />
        </Button>
      </Link>
    );
  }

  const percent = spotlight.tag === "rising" ? 15 : -15;

  async function handleApply() {
    setState("pending");
    try {
      await adjustBudgetByPercent(spotlight.campaignId, percent);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p css={{ fontSize: 13, fontWeight: 600, textAlign: "center", color: "var(--color-green-600)" }}>적용 완료</p>
    );
  }

  return (
    <Button
      size="md"
      variant={spotlight.tag === "rising" ? "primary" : "secondary"}
      disabled={state === "pending"}
      css={{ width: "100%" }}
      onClick={handleApply}
    >
      {state === "pending" ? (
        <span css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <HiArrowPath
            css={css`
              height: 1rem;
              width: 1rem;
              animation: spin 1s linear infinite;
              @keyframes spin {
                from {
                  transform: rotate(0deg);
                }
                to {
                  transform: rotate(360deg);
                }
              }
            `}
            aria-hidden="true"
          />
          적용 중...
        </span>
      ) : state === "error" ? (
        "다시 시도"
      ) : spotlight.tag === "rising" ? (
        <span css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <HiBolt style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 예산 15% 늘리기
        </span>
      ) : (
        <span css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <HiSparkles style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> AI가 개선하기
        </span>
      )}
    </Button>
  );
}

export function CampaignSpotlightCards({
  spotlights,
  engine,
  analyzing,
}: {
  spotlights: CampaignSpotlight[];
  engine: EngineKind | null;
  analyzing?: boolean;
}) {
  if (spotlights.length === 0) return null;

  return (
    <div>
      <div css={{ marginBottom: "0.875rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <div css={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>캠페인 한눈에 보기</h2>
            <EngineBadge engine={engine} analyzing={analyzing} />
          </div>
          <p css={{ marginTop: "0.125rem", fontSize: 13, color: "var(--color-gray-500)" }}>
            AI가 주요 캠페인 중 가장 주목할 만한 {spotlights.length}개를 골랐어요.
          </p>
        </div>
        <Link
          href="/campaigns"
          css={css`
            display: flex;
            flex-shrink: 0;
            align-items: center;
            gap: 0.125rem;
            font-size: 13px;
            font-weight: 500;
            color: var(--color-gray-500);
            white-space: nowrap;
            &:hover {
              color: var(--color-gray-700);
            }
          `}
        >
          전체 캠페인 보기
          <HiChevronRight style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
        </Link>
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.875rem;
          @media (min-width: 768px) {
            grid-template-columns: repeat(3, 1fr);
          }
        `}
      >
        {spotlights.map((spotlight) => {
          const tag = TAG_CONFIG[spotlight.tag];
          const TagIcon = tag.icon;
          const trendUp = spotlight.trendPct >= 0;
          const TrendIcon = trendUp ? HiArrowTrendingUp : HiArrowTrendingDown;

          return (
            <Card key={spotlight.id} css={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <span
                css={css`
                  display: inline-flex;
                  width: fit-content;
                  align-items: center;
                  gap: 0.25rem;
                  border-radius: 9999px;
                  padding: 0.25rem 0.625rem;
                  font-size: 12px;
                  font-weight: 600;
                `}
                style={{ backgroundColor: tag.bg, color: tag.color }}
              >
                <TagIcon style={{ height: "0.75rem", width: "0.75rem" }} aria-hidden="true" />
                {tag.label}
              </span>

              <div>
                <p css={{ fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>{spotlight.name}</p>
                <p css={{ marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: 13 }}>
                  <span css={{ color: "var(--color-gray-600)" }}>문의 {spotlight.conversions}건</span>
                  <span
                    css={{ display: "inline-flex", alignItems: "center", gap: "0.125rem", fontWeight: 600 }}
                    style={{ color: trendUp ? "var(--color-green-600)" : "var(--color-red-500)" }}
                  >
                    <TrendIcon style={{ height: "0.8125rem", width: "0.8125rem" }} aria-hidden="true" />
                    {formatSignedPercent(spotlight.trendPct, 0)}
                  </span>
                </p>
              </div>

              <LineChart data={spotlight.series} color={tag.color} height={40} />

              <SpotlightAction spotlight={spotlight} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
