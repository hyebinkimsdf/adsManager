"use client";

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
      <div className="flex flex-col gap-6">
        <SimpleHeader />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SimpleStat
            icon={HiOutlineChartBar}
            iconBg="bg-[var(--color-gray-100)]"
            iconColor="text-[var(--color-gray-700)]"
            label="이번 달 광고비"
            value={formatCompactKRW(monthSpend)}
            unit="원"
            {...trendCopy(trend(campaigns, "spend"), { up: "더 썼어요", down: "절약했어요", goodDirection: "down" })}
          />
          <SimpleStat
            icon={HiOutlineArrowTrendingUp}
            iconBg="bg-[var(--color-blue-50)]"
            iconColor="text-[var(--color-blue-600)]"
            label="전환 수"
            value={formatNumber(monthClicks)}
            unit="회"
            {...trendCopy(trend(campaigns, "clicks"), { up: "늘었어요", down: "줄었어요", goodDirection: "up" })}
          />
          <SimpleStat
            icon={HiOutlineShoppingCart}
            iconBg="bg-[var(--color-green-50)]"
            iconColor="text-[var(--color-green-600)]"
            label="구매 수"
            value={formatNumber(monthConversions)}
            unit="건"
            {...trendCopy(trend(campaigns, "conversions"), { up: "늘었어요", down: "줄었어요", goodDirection: "up" })}
          />
        </div>

        {simpleActions.length > 0 && (
          <div>
            <h2 className="mb-3 text-[15px] font-bold text-[var(--color-gray-900)]">지금 확인해주세요</h2>
            <div className="flex flex-col gap-2.5">
              {simpleActions.map((item) => (
                <SimpleActionCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <SimpleQuickActions campaigns={campaigns} />
            <SimpleCampaignCompare campaigns={campaigns} />
          </div>
          <div className="flex flex-col gap-4">
            <SimpleAssistantPanel />
            <SimpleTipCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--color-gray-900)]">오늘의 광고 현황</h1>
        <p className="mt-1 text-[13px] text-[var(--color-gray-500)]">
          우측 하단 ✨ 버튼을 눌러 AI에게 바로 물어볼 수 있어요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="오늘 지출" value={formatCompactKRW(todaySpend)} unit="원" trend={trend(campaigns, "spend")} />
        <SummaryCard label="오늘 전환" value={formatNumber(todayConversions)} unit="건" trend={trend(campaigns, "conversions")} />
        <SummaryCard label="7일 ROAS" value={formatPercent(roas7, 0)} trend={trend(campaigns, "revenue")} />
        <SummaryCard label="오늘 클릭" value={formatNumber(todayClicks)} unit="회" trend={trend(campaigns, "clicks")} />
      </div>

      {insights.length > 0 && (
        <Card>
          <p className="mb-3 text-[13px] font-semibold text-[var(--color-gray-500)]">AI 인사이트</p>
          <div className="flex flex-col gap-2.5">
            {insights.map((insight) => (
              <div key={insight.id} className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
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
                <p className="text-[14px] leading-relaxed text-[var(--color-gray-800)]">{insight.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[var(--color-gray-900)]">캠페인</h2>
          <Link href="/campaigns" className="text-[13px] font-medium text-[var(--color-blue-600)]">
            전체보기
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          {campaigns.slice(0, 4).map((c) => (
            <CampaignListItem key={c.id} campaign={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
