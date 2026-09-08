/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCampaigns } from "@/lib/mock/store";
import { useUiMode } from "@/lib/ui/mode";
import {
  buildInsights,
  buildWeeklyRecommendations,
  buildCampaignSpotlights,
  buildWeeklyCampaignInputs,
  hydrateWeeklyRecommendation,
  hydrateWeeklySpotlight,
  composeWeeklySummary,
  dailySeries,
  type WeeklyRecommendation,
  type CampaignSpotlight,
} from "@/lib/insights";
import { useWeeklyAnalysis } from "@/lib/ai/useWeeklyAnalysis";
import type { EngineKind } from "@/lib/ai/types";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { SimpleWeekHeader } from "@/components/dashboard/SimpleWeekHeader";
import { WeeklySummaryHighlight } from "@/components/dashboard/WeeklySummaryHighlight";
import { CampaignSpotlightCards } from "@/components/dashboard/CampaignSpotlightCards";
import { WeeklyRecommendationsCard } from "@/components/dashboard/WeeklyRecommendationsCard";
import { CampaignRankingCard } from "@/components/dashboard/CampaignRankingCard";
import { CampaignListItem } from "@/components/dashboard/CampaignListItem";
import { Card } from "@/components/ui/Card";
import { formatCompactKRW, formatNumber, formatPercent } from "@/lib/format";
import type { Campaign, DayMetric } from "@/lib/mock/types";

interface WeeklyAiState {
  recommendations: WeeklyRecommendation[];
  spotlights: CampaignSpotlight[];
  engine: EngineKind;
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

  // 이번 주 추천 액션/캠페인 스포트라이트를 실제 AI(온디바이스 → Gemini 클라우드)로 분석한다.
  // 응답을 기다리는 동안과 AI를 못 쓰는 환경에서는 규칙 기반 폴백을 즉시 보여주고, AI 결과가
  // 도착하면 조용히 교체한다 — 최대 18초씩 대시보드를 막아두지 않기 위함.
  const weeklyAnalysis = useWeeklyAnalysis();
  const [aiWeekly, setAiWeekly] = useState<WeeklyAiState | null>(null);
  const [weeklyAnalyzing, setWeeklyAnalyzing] = useState(false);
  const analyzedRef = useRef(false);

  useEffect(() => {
    if (mode !== "simple") return;
    if (weeklyAnalysis.state === "checking") return;
    if (analyzedRef.current) return;
    const inputs = buildWeeklyCampaignInputs(campaigns);
    if (inputs.length === 0) return;

    analyzedRef.current = true;
    let cancelled = false;

    async function run() {
      setWeeklyAnalyzing(true);
      try {
        const result = await weeklyAnalysis.analyze(inputs);
        if (cancelled || !result) return;
        const recommendations = result.reply.recommendations
          .map((r) => hydrateWeeklyRecommendation(campaigns, r))
          .filter((r): r is WeeklyRecommendation => r !== null)
          .slice(0, 3);
        const spotlights = result.reply.spotlights
          .map((s) => hydrateWeeklySpotlight(campaigns, s))
          .filter((s): s is CampaignSpotlight => s !== null)
          .slice(0, 3);
        if (recommendations.length > 0 || spotlights.length > 0) {
          setAiWeekly({ recommendations, spotlights, engine: result.engine });
        }
      } finally {
        if (!cancelled) setWeeklyAnalyzing(false);
      }
    }
    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, weeklyAnalysis.state]);

  if (mode === "simple") {
    const last7Conversions = combine(campaigns, 7, "conversions");
    const prevConversions = combine(campaigns, 14, "conversions") - last7Conversions;
    const spendTrendPct = trend(campaigns, "spend");
    const conversionsTrendPct = trend(campaigns, "conversions");

    const summary = composeWeeklySummary(spendTrendPct, conversionsTrendPct);
    const recommendations = aiWeekly?.recommendations ?? buildWeeklyRecommendations(campaigns);
    const spotlights = aiWeekly?.spotlights ?? buildCampaignSpotlights(campaigns);
    const weeklyEngine: EngineKind | null = aiWeekly?.engine ?? null;
    const conversionSeries = dailySeries(campaigns, 7, "conversions");

    const rangeEnd = new Date();
    const rangeStart = new Date(rangeEnd);
    rangeStart.setDate(rangeStart.getDate() - 6);

    return (
      <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <SimpleWeekHeader healthy={summary.healthy} subtitle={summary.subtitle} rangeStart={rangeStart} rangeEnd={rangeEnd} />

        <WeeklySummaryHighlight
          headline={summary.headline}
          highlight={summary.highlight}
          badge={summary.badge}
          healthy={summary.healthy}
          spend={{ current: last7Spend, previous: combine(campaigns, 14, "spend") - last7Spend }}
          conversions={{ current: last7Conversions, previous: prevConversions }}
          series={conversionSeries}
        />

        <CampaignSpotlightCards spotlights={spotlights} engine={weeklyEngine} analyzing={weeklyAnalyzing} />

        <div
          css={css`
            display: grid;
            grid-template-columns: 1fr;
            gap: 1rem;
            align-items: start;
            @media (min-width: 1024px) {
              grid-template-columns: 2fr 1fr;
            }
          `}
        >
          <WeeklyRecommendationsCard items={recommendations} engine={weeklyEngine} analyzing={weeklyAnalyzing} />
          <CampaignRankingCard campaigns={campaigns} />
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
