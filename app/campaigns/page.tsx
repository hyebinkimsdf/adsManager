"use client";

import { useState } from "react";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import { useCampaigns } from "@/lib/mock/store";
import { useUiMode } from "@/lib/ui/mode";
import { buildRoasBuckets } from "@/lib/insights";
import { CampaignListItem } from "@/components/dashboard/CampaignListItem";
import { SimpleSummaryHeader } from "@/components/campaigns/SimpleSummaryHeader";
import { SimpleRoasStatusCards } from "@/components/campaigns/SimpleRoasStatusCards";
import { SimpleAiRecommendBanner } from "@/components/campaigns/SimpleAiRecommendBanner";
import { SimpleQuickLinkCards } from "@/components/campaigns/SimpleQuickLinkCards";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "active", label: "진행 중" },
  { key: "paused", label: "일시정지" },
] as const;

export default function CampaignsPage() {
  const campaigns = useCampaigns();
  const mode = useUiMode();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [view, setView] = useState<"summary" | "list">("summary");

  const filtered = campaigns.filter((c) => filter === "all" || c.status === filter);

  const listSection = (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-[var(--color-gray-900)]">캠페인</h1>
        <Link href="/campaigns/new">
          <Button size="sm">+ 새 캠페인</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-[var(--radius-full)] px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              filter === f.key
                ? "bg-[var(--color-gray-900)] text-white"
                : "bg-white text-[var(--color-gray-600)] shadow-[var(--shadow-card)]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-white p-10 text-center text-[13px] text-[var(--color-gray-500)] shadow-[var(--shadow-card)]">
            조건에 맞는 캠페인이 없어요.
          </div>
        ) : (
          filtered.map((c) => <CampaignListItem key={c.id} campaign={c} />)
        )}
      </div>
    </div>
  );

  if (mode === "simple") {
    if (view === "list") {
      return (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={() => setView("summary")}
            className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
          >
            <HiOutlineArrowLeft className="h-4 w-4" aria-hidden="true" />
            요약으로 돌아가기
          </button>
          {listSection}
        </div>
      );
    }

    const buckets = buildRoasBuckets(campaigns);

    return (
      <div className="flex flex-col gap-5">
        <SimpleSummaryHeader />
        <SimpleRoasStatusCards buckets={buckets} />
        <SimpleAiRecommendBanner campaigns={campaigns} />
        <SimpleQuickLinkCards onShowList={() => setView("list")} />
      </div>
    );
  }

  return listSection;
}
