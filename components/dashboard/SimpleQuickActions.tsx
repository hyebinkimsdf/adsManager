"use client";

import { useState } from "react";
import { HiOutlineSparkles, HiViewfinderCircle, HiSparkles, HiCheck } from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { addKeywords, adjustBudgetByPercent } from "@/lib/mock/store";
import { sumHistory } from "@/lib/mock/campaigns";
import { INDUSTRY_TAILS } from "@/lib/ai/keywordHeuristics";
import { cn } from "@/lib/cn";
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
    iconBg: "bg-[var(--color-blue-50)]",
    iconColor: "text-[var(--color-blue-600)]",
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
    iconBg: "bg-[var(--color-green-50)]",
    iconColor: "text-[var(--color-green-600)]",
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
        <CardTitle className="flex items-center gap-1.5">
          <HiOutlineSparkles className="h-4 w-4 text-[var(--color-blue-500)]" aria-hidden="true" />
          AI 맞춤 추천
        </CardTitle>
      </CardHeader>
      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        {RECOMMENDATIONS.map((r) => {
          const isDone = done[r.id];
          const Icon = r.icon;
          return (
            <div key={r.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", r.iconBg)}>
                <Icon className={cn("h-5 w-5", r.iconColor)} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-[var(--color-gray-900)]">{r.label}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-gray-500)]">{r.detail}</p>
              </div>
              <button
                type="button"
                disabled={isDone}
                onClick={() => {
                  r.run(campaigns);
                  setDone((prev) => ({ ...prev, [r.id]: true }));
                }}
                className={cn(
                  "shrink-0 rounded-[var(--radius-full)] px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  isDone
                    ? "bg-[var(--color-green-50)] text-[var(--color-green-600)]"
                    : "bg-[var(--color-blue-50)] text-[var(--color-blue-600)] hover:bg-[var(--color-blue-100)]"
                )}
              >
                {isDone ? (
                  <span className="flex items-center gap-1">
                    <HiCheck className="h-4 w-4" aria-hidden="true" /> 적용 완료
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
