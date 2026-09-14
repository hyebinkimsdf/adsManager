/** @jsxImportSource @emotion/react */
"use client";

import { useState } from "react";
import Link from "next/link";
import { HiOutlineMagnifyingGlass, HiOutlinePlus, HiOutlineArrowPath, HiOutlineMegaphone } from "react-icons/hi2";
import { useCampaignsQuery } from "@/lib/mock/store";
import { filterCampaigns, type CampaignListFilter } from "@/lib/campaigns/list";
import { CampaignListItem } from "@/components/dashboard/CampaignListItem";
import { Button } from "@/components/ui/Button";
import { DataState } from "@/components/ui/DataState";

const FILTERS: { key: CampaignListFilter; label: string }[] = [
  { key: "all", label: "전체" }, { key: "active", label: "진행 중" },
  { key: "paused", label: "멈춤·저장됨" }, { key: "draft", label: "초안" },
];
const PAGE_SIZE = 30;

export default function CampaignsPage() {
  const query = useCampaignsQuery();
  const [filter, setFilter] = useState<CampaignListFilter>("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const campaigns = query.data ?? [];
  const filtered = filterCampaigns(campaigns, filter, search);
  const hasExamples = campaigns.some(c => c.metricSource === "demo");

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header css={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 css={{ fontSize: 24, fontWeight: 750 }}>내 광고</h1>
          <p css={{ marginTop: 6, fontSize: 14, color: "var(--color-gray-500)" }}>만들고, 확인하고, 필요한 것만 바꿔요.</p>
        </div>
        <Link href="/campaigns/new" css={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 12, padding: "12px 16px", background: "var(--color-blue-500)", color: "white", fontWeight: 650, fontSize: 14 }}>
          <HiOutlinePlus size={19} aria-hidden="true" /> 새 광고 만들기
        </Link>
      </header>
      {query.isPending ? <DataState title="광고를 불러오고 있어요" /> : query.isError ? (
        <DataState title={query.data ? "새 정보를 가져오지 못했어요. 이전 내용을 보여드려요." : "광고를 불러오지 못했어요"} error onRetry={() => void query.refetch()} />
      ) : <div role="status" css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--color-gray-500)" }}>
        <span>{query.isFetching ? "새 정보를 확인하고 있어요" : `저장된 광고 ${campaigns.length.toLocaleString()}개`}{hasExamples ? " · 예시 실적 포함" : ""}</span>
        <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} css={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 8 }}>
          <HiOutlineArrowPath aria-hidden="true" /> 새로고침
        </button>
      </div>}
      {query.data && <>
        <label css={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "12px 14px" }}>
          <HiOutlineMagnifyingGlass size={20} aria-hidden="true" />
          <input aria-label="광고 이름 검색" placeholder="광고 이름으로 찾아보세요" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }} css={{ flex: 1, minWidth: 0, fontSize: 14, background: "transparent" }} />
        </label>
        <div role="group" aria-label="광고 상태" css={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FILTERS.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setVisibleCount(PAGE_SIZE); }} css={{ padding: "9px 13px", borderRadius: 20, fontSize: 13, fontWeight: 600, color: filter === item.key ? "white" : "var(--color-gray-600)", background: filter === item.key ? "var(--color-gray-900)" : "white" }}>
            {item.label} {filterCampaigns(campaigns, item.key, "").length.toLocaleString()}
          </button>)}
        </div>
        <div css={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.slice(0, visibleCount).map(campaign => <CampaignListItem key={campaign.id} campaign={campaign} />)}
          {filtered.length === 0 && <div css={{ padding: "40px 16px", borderRadius: 16, background: "white", textAlign: "center" }}>
            <HiOutlineMegaphone size={30} aria-hidden="true" css={{ margin: "0 auto 12px", color: "var(--color-gray-400)" }} />
            <p css={{ fontSize: 15, fontWeight: 600 }}>{campaigns.length === 0 ? "첫 광고를 만들어 볼까요?" : "찾는 광고가 없어요"}</p>
            <p css={{ marginTop: 6, fontSize: 13, color: "var(--color-gray-500)" }}>{campaigns.length === 0 ? "설정을 저장해도 광고가 바로 시작되진 않아요." : "이름이나 상태를 바꿔서 찾아보세요."}</p>
          </div>}
        </div>
        {visibleCount < filtered.length && <Button variant="secondary" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>더 보기 · {filtered.length - visibleCount}개 남음</Button>}
      </>}
    </div>
  );
}
