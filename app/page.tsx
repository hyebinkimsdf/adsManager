/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { useCampaignsSummaryQuery } from "@/lib/mock/store";
import { DataState } from "@/components/ui/DataState";
import { useUiMode } from "@/lib/ui/mode";
import { composeWeeklySummary } from "@/lib/insights";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { SimpleWeekHeader } from "@/components/dashboard/SimpleWeekHeader";
import { WeeklySummaryHighlight } from "@/components/dashboard/WeeklySummaryHighlight";
import { WeeklyRecommendationsCard } from "@/components/dashboard/WeeklyRecommendationsCard";
import { PerformanceTestInjector } from "@/components/dashboard/PerformanceTestInjector";
import { CampaignListItem } from "@/components/dashboard/CampaignListItem";
import { Card } from "@/components/ui/Card";
import { formatCompactKRW, formatNumber, formatPercent } from "@/lib/format";

export default function HomePage() {
  const query = useCampaignsSummaryQuery();
  const summary = query.data;
  const mode = useUiMode();

  if (query.isPending) return <DataState title="광고 현황을 불러오고 있어요" />;
  if (!summary) return <DataState title="광고 현황을 불러오지 못했어요" error onRetry={() => void query.refetch()} />;
  const dataNotice = query.isError ? (
    <DataState title="갱신하지 못했어요. 이전 내용을 보여드려요." error onRetry={() => void query.refetch()} />
  ) : null;

  if (summary.totalCampaignCount === 0) return <div css={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <DataState title="아직 저장된 광고가 없어요" />
    <Link href="/campaigns/new" css={{ color: "var(--color-blue-600)", fontWeight: 650 }}>첫 광고 만들기 →</Link>
  </div>;

  if (mode === "simple") {
    const weekSummary = composeWeeklySummary(summary.trendPct.spend, summary.trendPct.conversions);
    const recommendations = summary.weeklyRecommendations;

    const rangeEnd = new Date();
    const rangeStart = new Date(rangeEnd);
    rangeStart.setDate(rangeStart.getDate() - 6);

    return (
      <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {dataNotice}
        <SimpleWeekHeader healthy={weekSummary.healthy} subtitle={weekSummary.subtitle} rangeStart={rangeStart} rangeEnd={rangeEnd} />

        <WeeklySummaryHighlight
          headline={weekSummary.headline}
          highlight={weekSummary.highlight}
          badge={weekSummary.badge}
          healthy={weekSummary.healthy}
          spend={{ current: summary.last7.spend, previous: summary.prev7.spend }}
          conversions={{ current: summary.last7.conversions, previous: summary.prev7.conversions }}
        />

        <PerformanceTestInjector campaigns={summary.topCampaigns} />
        <WeeklyRecommendationsCard items={recommendations} />
      </div>
    );
  }

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {dataNotice}
      <div>
        <h1 css={{ fontSize: 20, fontWeight: 700, color: "var(--color-gray-900)" }}>오늘의 광고 현황</h1>
        <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-600)" }}>
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
        <SummaryCard label="오늘 지출" value={formatCompactKRW(summary.today.spend)} unit="원" trend={summary.trendPct.spend} />
        <SummaryCard label="오늘 전환" value={formatNumber(summary.today.conversions)} unit="건" trend={summary.trendPct.conversions} />
        <SummaryCard label="7일 ROAS" value={formatPercent(summary.last7.roas, 0)} trend={summary.trendPct.revenue} />
        <SummaryCard label="오늘 클릭" value={formatNumber(summary.today.clicks)} unit="회" trend={summary.trendPct.clicks} />
      </div>

      {summary.insights.length > 0 && (
        <Card>
          <p css={{ marginBottom: "0.75rem", fontSize: 13, fontWeight: 600, color: "var(--color-gray-600)" }}>숫자로 본 광고 현황</p>
          <div css={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {summary.insights.map((insight) => (
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
          {summary.recentCampaigns.map((c) => (
            <CampaignListItem key={c.id} campaign={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
