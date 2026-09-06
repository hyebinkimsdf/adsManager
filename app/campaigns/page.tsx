/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
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
    <div css={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 css={{ fontSize: 20, fontWeight: 700, color: "var(--color-gray-900)" }}>캠페인</h1>
        <Link href="/campaigns/new">
          <Button size="sm">+ 새 캠페인</Button>
        </Link>
      </div>

      <div css={{ display: "flex", gap: "0.5rem" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            css={css`
              border-radius: 9999px;
              padding: 0.375rem 0.875rem;
              font-size: 13px;
              font-weight: 500;
              transition: background-color 150ms, color 150ms;
              background-color: ${filter === f.key ? "var(--color-gray-900)" : "white"};
              color: ${filter === f.key ? "white" : "var(--color-gray-600)"};
              box-shadow: ${filter === f.key ? "none" : "var(--shadow-card)"};
            `}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div css={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {filtered.length === 0 ? (
          <div
            css={css`
              border-radius: var(--radius-lg);
              background: white;
              padding: 2.5rem;
              text-align: center;
              font-size: 13px;
              color: var(--color-gray-500);
              box-shadow: var(--shadow-card);
            `}
          >
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
        <div css={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <button
            type="button"
            onClick={() => setView("summary")}
            css={css`
              display: flex;
              width: fit-content;
              align-items: center;
              gap: 0.375rem;
              font-size: 13px;
              font-weight: 500;
              color: var(--color-gray-500);

              &:hover {
                color: var(--color-gray-700);
              }
            `}
          >
            <HiOutlineArrowLeft style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
            요약으로 돌아가기
          </button>
          {listSection}
        </div>
      );
    }

    const buckets = buildRoasBuckets(campaigns);

    return (
      <div css={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <SimpleSummaryHeader />
        <SimpleRoasStatusCards buckets={buckets} />
        <SimpleAiRecommendBanner campaigns={campaigns} />
        <SimpleQuickLinkCards onShowList={() => setView("list")} />
      </div>
    );
  }

  return listSection;
}
