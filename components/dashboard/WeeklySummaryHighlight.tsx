/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { HiOutlineArrowTrendingUp, HiOutlineCreditCard, HiOutlineUserGroup } from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Card } from "@/components/ui/Card";
import { formatCompactKRW, formatKRW, formatNumber } from "@/lib/format";

function StatBlock({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  unit,
  increased,
  trendGood,
  detail,
}: {
  icon: IconType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  unit?: string;
  /** 지난주 대비 실제 증가(true)·감소(false) 방향 — 화살표 모양(▲/▼)을 결정한다. */
  increased: boolean | null;
  /** 이 지표에서 그 방향이 좋은 신호인지 — 색상을 결정한다. 지표마다 "좋음"의 방향이 다르다
   * (광고비는 줄면 좋고, 문의/구매는 늘면 좋다). */
  trendGood: boolean | null;
  detail: string;
}) {
  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: 0 }}>
      <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          css={{
            display: "flex",
            height: "2rem",
            width: "2rem",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "9999px",
            backgroundColor: iconBg,
          }}
        >
          <Icon style={{ height: "1rem", width: "1rem", color: iconColor }} aria-hidden="true" />
        </span>
        <span css={{ fontSize: 13, color: "var(--color-gray-600)" }}>{label}</span>
      </div>
      <p css={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
        <span css={{ fontSize: 22, fontWeight: 700, color: "var(--color-gray-900)" }}>{value}</span>
        {unit && <span css={{ fontSize: 12, color: "var(--color-gray-600)" }}>{unit}</span>}
        {increased !== null && (
          <span
            css={{
              marginLeft: "0.125rem",
              fontSize: 12,
              fontWeight: 600,
              color: trendGood ? "var(--color-green-600)" : "var(--color-red-500)",
            }}
          >
            {increased ? "▲" : "▼"}
          </span>
        )}
      </p>
      <p css={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-gray-600)" }}>{detail}</p>
    </div>
  );
}

const BADGE_TONE: Record<"healthy" | "attention" | "observing", { bg: string; color: string }> = {
  healthy: { bg: "var(--color-green-50)", color: "var(--color-green-600)" },
  attention: { bg: "var(--color-red-50)", color: "var(--color-red-500)" },
  observing: { bg: "var(--color-gray-100)", color: "var(--color-gray-600)" },
};

export function WeeklySummaryHighlight({
  headline,
  highlight,
  badge,
  status,
  detail,
  spend,
  conversions,
}: {
  headline: string;
  highlight: string;
  badge: string;
  status: "healthy" | "attention" | "observing";
  /** 배지 아래에 보여줄 구체적인 이유 — 어떤 캠페인이 왜 그런지. 없으면 줄 자체를 생략한다. */
  detail?: string;
  spend: { current: number; previous: number };
  conversions: { current: number; previous: number };
}) {
  const spendDelta = spend.current - spend.previous;
  const spendDown = spendDelta <= 0;
  const spendDetail =
    spendDelta === 0
      ? "지난주와 광고비가 같아요."
      : `지난주보다 ${formatKRW(Math.abs(spendDelta))}원 ${spendDown ? "적게" : "더"} 사용했어요.`;

  const conversionsDelta = conversions.current - conversions.previous;
  const conversionsUp = conversionsDelta >= 0;
  const conversionsDetail =
    conversionsDelta === 0
      ? "지난주와 문의 수가 같아요."
      : `지난주보다 ${formatNumber(Math.abs(conversionsDelta))}건 ${conversionsUp ? "늘었어요." : "줄었어요."}`;

  const headlineParts = highlight ? headline.split(highlight) : [headline];

  return (
    <Card>
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          @media (min-width: 1024px) {
            flex-direction: row;
            align-items: center;
          }
        `}
      >
        <div css={{ flex: "1 1 40%", minWidth: 0 }}>
          <div css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <HiOutlineArrowTrendingUp style={{ height: "1rem", width: "1rem", color: "var(--color-green-600)" }} aria-hidden="true" />
            <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-600)" }}>이번 주 핵심 요약</span>
          </div>
          <p css={{ marginTop: "0.5rem", fontSize: 19, fontWeight: 700, lineHeight: 1.45, color: "var(--color-gray-900)" }}>
            {headlineParts.length === 2 ? (
              <>
                {headlineParts[0]}
                <span css={{ color: "var(--color-blue-600)" }}>{highlight}</span>
                {headlineParts[1]}
              </>
            ) : (
              headline
            )}
          </p>
          {detail && (
            <p css={{ marginTop: "0.375rem", fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
              {detail}
            </p>
          )}
        </div>

        <div
          css={css`
            display: grid;
            flex: 1 1 auto;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.25rem;
            border-top: 1px solid var(--border-subtle);
            padding-top: 1.25rem;
            @media (min-width: 1024px) {
              border-top: none;
              border-left: 1px solid var(--border-subtle);
              padding-top: 0;
              padding-left: 1.5rem;
            }
          `}
        >
          <StatBlock
            icon={HiOutlineCreditCard}
            iconBg="var(--color-blue-50)"
            iconColor="var(--color-blue-600)"
            label="광고비"
            value={formatCompactKRW(spend.current)}
            unit="원"
            increased={spendDelta === 0 ? null : spendDelta > 0}
            trendGood={spendDelta === 0 ? null : spendDown}
            detail={spendDetail}
          />
          <StatBlock
            icon={HiOutlineUserGroup}
            iconBg="var(--color-green-50)"
            iconColor="var(--color-green-600)"
            label="문의 / 구매"
            value={formatNumber(conversions.current)}
            unit="건"
            increased={conversionsDelta === 0 ? null : conversionsDelta > 0}
            trendGood={conversionsDelta === 0 ? null : conversionsUp}
            detail={conversionsDetail}
          />
        </div>

        <span
          css={css`
            flex-shrink: 0;
            align-self: flex-start;
            white-space: nowrap;
            border-radius: 9999px;
            padding: 0.25rem 0.75rem;
            font-size: 12px;
            font-weight: 600;
            background-color: ${BADGE_TONE[status].bg};
            color: ${BADGE_TONE[status].color};
            @media (min-width: 1024px) {
              align-self: center;
            }
          `}
        >
          {badge}
        </span>
      </div>
    </Card>
  );
}
