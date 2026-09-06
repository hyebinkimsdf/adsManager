/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { HiOutlineChartBar, HiOutlineArrowTrendingUp, HiOutlineShoppingCart } from "react-icons/hi2";
import { useCampaigns } from "@/lib/mock/store";
import { useUiMode } from "@/lib/ui/mode";
import { buildInsights, buildSimpleActions } from "@/lib/insights";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { SimpleHeader } from "@/components/dashboard/SimpleHeader";
import { SimpleStat } from "@/components/dashboard/SimpleStat";
import { SimpleActionCard } from "@/components/dashboard/SimpleActionCard";
import { SimpleQuickActions } from "@/components/dashboard/SimpleQuickActions";
import { SimpleCampaignCompare } from "@/components/dashboard/SimpleCampaignCompare";
import { SimpleAssistantPanel } from "@/components/dashboard/SimpleAssistantPanel";
import { SimpleTipCard } from "@/components/dashboard/SimpleTipCard";
import { CampaignListItem } from "@/components/dashboard/CampaignListItem";
import { Card } from "@/components/ui/Card";
import { formatCompactKRW, formatNumber, formatPercent } from "@/lib/format";
import type { Campaign, DayMetric } from "@/lib/mock/types";

function trendCopy(value: number, opts: { up: string; down: string; goodDirection: "up" | "down" }) {
  if (Math.abs(value) < 1) return { trendPercent: undefined, trendSuffix: undefined, trendTone: "neutral" as const };
  const isUp = value > 0;
  const isGood = opts.goodDirection === "up" ? isUp : !isUp;
  return {
    trendPercent: value,
    trendSuffix: isUp ? opts.up : opts.down,
    trendTone: isGood ? ("positive" as const) : ("negative" as const),
  };
}

function combine(campaigns: Campaign[], days: number, key: keyof DayMetric): number {
  return campaigns.reduce((sum, c) => {
    const slice = c.history.slice(-days);
    return sum + slice.reduce((s, d) => s + (d[key] as number), 0);
  }, 0);
}

function trend(campaigns: Campaign[], key: keyof DayMetric): number {
  const recent = combine(campaigns, 7, key);
  const previous = combine(campaigns, 14, key) - recent;
  if (previous === 0) return 0;
  return ((recent - previous) / previous) * 100;
}

export default function HomePage() {
  const campaigns = useCampaigns();
  const mode = useUiMode();
  const insights = buildInsights(campaigns);

  const todaySpend = campaigns.reduce((sum, c) => sum + (c.history.at(-1)?.spend ?? 0), 0);
  const todayConversions = campaigns.reduce((sum, c) => sum + (c.history.at(-1)?.conversions ?? 0), 0);
  const todayClicks = campaigns.reduce((sum, c) => sum + (c.history.at(-1)?.clicks ?? 0), 0);

  const last7Spend = combine(campaigns, 7, "spend");
  const last7Revenue = combine(campaigns, 7, "revenue");
  const roas7 = last7Spend > 0 ? (last7Revenue / last7Spend) * 100 : 0;

  if (mode === "simple") {
    const simpleActions = buildSimpleActions(campaigns);
    const monthSpend = combine(campaigns, 14, "spend");
    const monthClicks = combine(campaigns, 14, "clicks");
    const monthConversions = combine(campaigns, 14, "conversions");

    return (
      <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <SimpleHeader />

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
          <SimpleStat
            icon={HiOutlineChartBar}
            iconBg="var(--color-gray-100)"
            iconColor="var(--color-gray-700)"
            label="이번 달 광고비"
            value={formatCompactKRW(monthSpend)}
            unit="원"
            {...trendCopy(trend(campaigns, "spend"), { up: "더 썼어요", down: "절약했어요", goodDirection: "down" })}
          />
          <SimpleStat
            icon={HiOutlineArrowTrendingUp}
            iconBg="var(--color-blue-50)"
            iconColor="var(--color-blue-600)"
            label="전환 수"
            value={formatNumber(monthClicks)}
            unit="회"
            {...trendCopy(trend(campaigns, "clicks"), { up: "늘었어요", down: "줄었어요", goodDirection: "up" })}
          />
          <SimpleStat
            icon={HiOutlineShoppingCart}
            iconBg="var(--color-green-50)"
            iconColor="var(--color-green-600)"
            label="구매 수"
            value={formatNumber(monthConversions)}
            unit="건"
            {...trendCopy(trend(campaigns, "conversions"), { up: "늘었어요", down: "줄었어요", goodDirection: "up" })}
          />
        </div>

        {simpleActions.length > 0 && (
          <div>
            <h2 css={{ marginBottom: "0.75rem", fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>
              지금 확인해주세요
            </h2>
            <div css={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {simpleActions.map((item) => (
                <SimpleActionCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        <div
          css={css`
            display: grid;
            grid-template-columns: 1fr;
            gap: 1rem;
            @media (min-width: 1024px) {
              grid-template-columns: repeat(3, 1fr);
            }
          `}
        >
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
              @media (min-width: 1024px) {
                grid-column: span 2 / span 2;
              }
            `}
          >
            <SimpleQuickActions campaigns={campaigns} />
            <SimpleCampaignCompare campaigns={campaigns} />
          </div>
          <div css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <SimpleAssistantPanel />
            <SimpleTipCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 css={{ fontSize: 20, fontWeight: 700, color: "var(--color-gray-900)" }}>오늘의 광고 현황</h1>
        <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-500)" }}>
          우측 하단 ✨ 버튼을 눌러 AI에게 바로 물어볼 수 있어요.
        </p>
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          @media (min-width: 640px) {
            grid-template-columns: repeat(4, 1fr);
          }
        `}
      >
        <SummaryCard label="오늘 지출" value={formatCompactKRW(todaySpend)} unit="원" trend={trend(campaigns, "spend")} />
        <SummaryCard label="오늘 전환" value={formatNumber(todayConversions)} unit="건" trend={trend(campaigns, "conversions")} />
        <SummaryCard label="7일 ROAS" value={formatPercent(roas7, 0)} trend={trend(campaigns, "revenue")} />
        <SummaryCard label="오늘 클릭" value={formatNumber(todayClicks)} unit="회" trend={trend(campaigns, "clicks")} />
      </div>

      {insights.length > 0 && (
        <Card>
          <p css={{ marginBottom: "0.75rem", fontSize: 13, fontWeight: 600, color: "var(--color-gray-500)" }}>AI 인사이트</p>
          <div css={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {insights.map((insight) => (
              <div key={insight.id} css={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span
                  css={{
                    marginTop: "0.25rem",
                    height: "0.375rem",
                    width: "0.375rem",
                    flexShrink: 0,
                    borderRadius: "9999px",
                  }}
                  style={{
                    background:
                      insight.tone === "positive"
                        ? "var(--color-green-600)"
                        : insight.tone === "negative"
                        ? "var(--color-red-500)"
                        : "var(--color-gray-400)",
                  }}
                  aria-hidden="true"
                />
                <p css={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-gray-800)" }}>{insight.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <div css={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 css={{ fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>캠페인</h2>
          <Link href="/campaigns" css={{ fontSize: 13, fontWeight: 500, color: "var(--color-blue-600)" }}>
            전체보기
          </Link>
        </div>
        <div css={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {campaigns.slice(0, 4).map((c) => (
            <CampaignListItem key={c.id} campaign={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
