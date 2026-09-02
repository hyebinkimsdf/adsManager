"use client";

import { useState } from "react";
import { HiSparkles, HiXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { AvailabilityBanner } from "@/components/assistant/AvailabilityBanner";
import { useKeywordAssistant } from "@/lib/ai/useKeywordAssistant";
import {
  fetchKeywordBidEstimates,
  fetchPositionEstimate,
  type KeywordBidEstimateDto,
} from "@/lib/ai/naverBidClient";
import { cn } from "@/lib/cn";
import { formatCompactKRW, formatKRW } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { EngineKind, KeywordSuggestion } from "@/lib/ai/types";
import type { CampaignChannel, CampaignIndustry, CampaignObjective } from "@/lib/mock/types";

const MATCH_TYPE_LABEL: Record<KeywordSuggestion["matchType"], string> = {
  broad: "확장",
  phrase: "구문",
  exact: "일치",
};

const COMPETITION_LABEL: Record<NonNullable<KeywordSuggestion["competition"]>, string> = {
  low: "경쟁 낮음",
  medium: "경쟁 중간",
  high: "경쟁 높음",
};

const COMPETITION_TONE: Record<NonNullable<KeywordSuggestion["competition"]>, "green" | "blue" | "red"> = {
  low: "green",
  medium: "blue",
  high: "red",
};

const SCALE_OPTIONS: { key: "small" | "medium" | "bulk"; label: string; limit: number }[] = [
  { key: "small", label: "기본 (8개)", limit: 8 },
  { key: "medium", label: "보통 (30개)", limit: 30 },
  { key: "bulk", label: "대량 (300개)", limit: 300 },
];

const SUB_PREVIEW_COUNT = 40;

export function KeywordAssistant({
  objective,
  channels,
  industry,
  name,
  selected,
  onChange,
  onBidsChange,
  onBudgetEstimate,
  onConfirm,
  confirmLabel = "다음",
}: {
  objective: CampaignObjective;
  channels: CampaignChannel[];
  industry: CampaignIndustry;
  name: string;
  selected: string[];
  onChange: (keywords: string[]) => void;
  onBidsChange?: (bids: Record<string, number>) => void;
  onBudgetEstimate?: (dailyCost: number) => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  const { state, downloadProgress, suggest } = useKeywordAssistant();
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [engine, setEngine] = useState<EngineKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);
  const [draft, setDraft] = useState("");
  const [bidEstimates, setBidEstimates] = useState<KeywordBidEstimateDto[] | null>(null);
  const [bids, setBids] = useState<Record<string, number>>({});
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bidsAsked, setBidsAsked] = useState(false);
  const [positionCost, setPositionCost] = useState<Record<string, { clicks: number; cost: number }>>({});
  const [positionLoading, setPositionLoading] = useState<Record<string, boolean>>({});
  const [customPosition, setCustomPosition] = useState<Record<string, string>>({});
  const [scale, setScale] = useState<"small" | "medium" | "bulk">("small");
  const [subExpanded, setSubExpanded] = useState(false);

  const coreSuggestions = suggestions.filter((s) => s.tier !== "sub");
  const subSuggestions = suggestions.filter((s) => s.tier === "sub");

  async function handleSuggest() {
    setLoading(true);
    setHasAsked(true);
    setSubExpanded(false);
    const limit = SCALE_OPTIONS.find((o) => o.key === scale)!.limit;
    const { reply, engine: usedEngine } = await suggest({ objective, channels, industry, name }, { limit });
    setSuggestions(reply.keywords);
    setEngine(usedEngine);
    setLoading(false);
  }

  async function handleEstimateBids() {
    setBidsLoading(true);
    setBidsAsked(true);
    setPositionCost({});
    const result = await fetchKeywordBidEstimates(selected);
    setBidEstimates(result);
    if (result) {
      const nextBids: Record<string, number> = {};
      let totalDailyCost = 0;
      for (const e of result) {
        nextBids[e.keyword] = bids[e.keyword] ?? e.medianBid;
        totalDailyCost += e.estimatedDailyCost;
      }
      setBids(nextBids);
      onBidsChange?.(nextBids);
      onBudgetEstimate?.(totalDailyCost);
    }
    setBidsLoading(false);
  }

  function costOf(e: KeywordBidEstimateDto): number {
    return positionCost[e.keyword]?.cost ?? e.estimatedDailyCost;
  }

  function computeTotal(costs: Record<string, { clicks: number; cost: number }>): number {
    if (!bidEstimates) return 0;
    return bidEstimates
      .filter((e) => selected.includes(e.keyword))
      .reduce((sum, e) => sum + (costs[e.keyword]?.cost ?? e.estimatedDailyCost), 0);
  }

  function updateBid(keyword: string, value: number) {
    const next = { ...bids, [keyword]: value };
    setBids(next);
    onBidsChange?.(next);
  }

  // 순위 프리셋 칩과 직접 입력한 순위 모두 이 핸들러로 처리해, 입찰가와 하루 예상 비용을 함께 갱신한다.
  async function applyPosition(keyword: string, position: number) {
    setPositionLoading((prev) => ({ ...prev, [keyword]: true }));
    const result = await fetchPositionEstimate(keyword, position);
    setPositionLoading((prev) => ({ ...prev, [keyword]: false }));
    if (!result) return;

    updateBid(keyword, result.bid);
    const nextCosts = {
      ...positionCost,
      [keyword]: { clicks: result.estimatedDailyClicks, cost: result.estimatedDailyCost },
    };
    setPositionCost(nextCosts);
    onBudgetEstimate?.(computeTotal(nextCosts));
  }

  function toggle(keyword: string) {
    onChange(selected.includes(keyword) ? selected.filter((k) => k !== keyword) : [...selected, keyword]);
  }

  function applyAllSuggested() {
    onChange(Array.from(new Set([...selected, ...suggestions.map((s) => s.keyword)])));
  }

  function applyCoreOnly() {
    onChange(Array.from(new Set([...selected, ...coreSuggestions.map((s) => s.keyword)])));
  }

  function renderKeywordChip(s: KeywordSuggestion) {
    const active = selected.includes(s.keyword);
    return (
      <button
        key={s.keyword}
        type="button"
        onClick={() => toggle(s.keyword)}
        className={cn(
          "flex items-center gap-1.5 rounded-[var(--radius-full)] border px-3 py-1.5 text-[13px] font-medium transition-colors",
          active
            ? "border-[var(--color-blue-500)] bg-[var(--color-blue-50)] text-[var(--color-blue-600)]"
            : "border-[var(--border-subtle)] bg-white text-[var(--color-gray-700)] hover:border-[var(--color-blue-500)]"
        )}
      >
        {s.keyword}
        {s.monthlySearches !== undefined ? (
          <>
            <span className="rounded-[var(--radius-full)] bg-[var(--color-gray-100)] px-1.5 py-0.5 text-[10px] text-[var(--color-gray-500)]">
              월 {formatCompactKRW(s.monthlySearches)}회
            </span>
            {s.competition && (
              <Badge tone={COMPETITION_TONE[s.competition]} className="px-1.5 py-0.5 text-[10px]">
                {COMPETITION_LABEL[s.competition]}
              </Badge>
            )}
          </>
        ) : (
          <span className="rounded-[var(--radius-full)] bg-[var(--color-gray-100)] px-1.5 py-0.5 text-[10px] text-[var(--color-gray-500)]">
            {MATCH_TYPE_LABEL[s.matchType]}
          </span>
        )}
      </button>
    );
  }

  function addCustom() {
    const value = draft.trim();
    setDraft("");
    if (!value || selected.includes(value)) return;
    onChange([...selected, value]);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--color-gray-50)] p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-[var(--color-gray-500)]">몇 개 정도 추천받을까요?</span>
        {SCALE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setScale(opt.key)}
            className={cn(
              "rounded-[var(--radius-full)] border px-2.5 py-1 text-[11px] font-medium transition-colors",
              scale === opt.key
                ? "border-[var(--color-blue-500)] bg-[var(--color-blue-50)] text-[var(--color-blue-600)]"
                : "border-[var(--border-subtle)] text-[var(--color-gray-500)] hover:border-[var(--color-blue-500)]"
            )}
          >
            {opt.label}
          </button>
        ))}
        {scale === "bulk" && (
          <span className="text-[11px] text-[var(--color-gray-400)]">
            핵심·서브 키워드로 나눠서 보여드려요
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={handleSuggest} disabled={loading}>
          <HiSparkles className="h-4 w-4" aria-hidden="true" />
          {hasAsked ? "다시 추천받기" : "AI로 키워드 추천받기"}
        </Button>
        {suggestions.length > 0 && (
          <div className="flex items-center gap-3">
            {subSuggestions.length > 0 && (
              <button
                type="button"
                onClick={applyCoreOnly}
                className="text-[12px] font-medium text-[var(--color-blue-600)] hover:underline"
              >
                핵심만 적용
              </button>
            )}
            <button
              type="button"
              onClick={applyAllSuggested}
              className="text-[12px] font-medium text-[var(--color-blue-600)] hover:underline"
            >
              추천 전체 적용
            </button>
          </div>
        )}
      </div>

      {hasAsked && !loading && engine === "naver-ads" && (
        <div className="flex items-center gap-1.5 px-1 pb-2 text-[12px] text-[var(--color-gray-500)]">
          <Badge tone="green">실검색 데이터</Badge>
          <span>네이버 검색광고의 월간 검색수·경쟁정도를 기반으로 추천해요</span>
        </div>
      )}
      {hasAsked && !loading && engine !== "naver-ads" && (
        <AvailabilityBanner state={state} downloadProgress={downloadProgress} />
      )}

      {loading && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="flex flex-col gap-3">
          {subSuggestions.length === 0 ? (
            <div className="flex flex-wrap gap-2">{coreSuggestions.map(renderKeywordChip)}</div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--color-gray-500)]">
                  핵심 키워드 ({coreSuggestions.length})
                </span>
                <div className="flex flex-wrap gap-2">{coreSuggestions.map(renderKeywordChip)}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--color-gray-500)]">
                  서브 키워드 ({subSuggestions.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {(subExpanded ? subSuggestions : subSuggestions.slice(0, SUB_PREVIEW_COUNT)).map(renderKeywordChip)}
                </div>
                {subSuggestions.length > SUB_PREVIEW_COUNT && (
                  <button
                    type="button"
                    onClick={() => setSubExpanded((v) => !v)}
                    className="self-start text-[12px] font-medium text-[var(--color-blue-600)] hover:underline"
                  >
                    {subExpanded ? "접기" : `서브 키워드 ${subSuggestions.length - SUB_PREVIEW_COUNT}개 더보기`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="직접 키워드 추가"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--color-blue-500)]"
        />
        <Button type="button" size="md" variant="secondary" disabled={!draft.trim()} onClick={addCustom}>
          추가
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((k) => (
            <span
              key={k}
              className="flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-blue-50)] py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-[var(--color-blue-600)]"
            >
              {k}
              <button type="button" onClick={() => toggle(k)} aria-label={`${k} 제거`} className="rounded-full p-0.5 hover:bg-[var(--color-blue-100)]">
                <HiXMark className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-gray-900)]">키워드별 단가 · 예상 예산</span>
            <Button type="button" size="sm" variant="secondary" onClick={handleEstimateBids} disabled={bidsLoading}>
              {bidsAsked ? "다시 계산" : "예상 단가 확인"}
            </Button>
          </div>

          {bidsLoading && (
            <div className="flex flex-col gap-1.5">
              {selected.map((k) => (
                <Skeleton key={k} className="h-9 w-full" />
              ))}
            </div>
          )}

          {!bidsLoading && bidsAsked && !bidEstimates && (
            <p className="text-[12px] text-[var(--color-gray-500)]">
              네이버 검색광고 API 연동이 안 돼 있어 단가를 예측할 수 없어요. 예산은 직접 정해주세요.
            </p>
          )}

          {!bidsLoading && bidEstimates && (
            <div className="flex flex-col gap-2">
              {bidEstimates
                .filter((e) => selected.includes(e.keyword))
                .map((e) => (
                  <div key={e.keyword} className="flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-gray-700)]">{e.keyword}</span>
                      <span className="shrink-0 text-[var(--color-gray-400)]">최소 {formatKRW(e.minBid)}원</span>
                      <input
                        type="number"
                        value={bids[e.keyword] ?? e.medianBid}
                        onChange={(ev) => updateBid(e.keyword, Number(ev.target.value))}
                        className="w-24 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-2 py-1 text-right outline-none focus:border-[var(--color-blue-500)]"
                      />
                      <span className="shrink-0 text-[var(--color-gray-400)]">원</span>
                      <span className="shrink-0 text-[var(--color-gray-400)]">
                        일 {formatCompactKRW(costOf(e))}원 예상
                      </span>
                    </div>
                    {e.positionBids.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
                        <span className="text-[11px] text-[var(--color-gray-400)]">순위별 입찰가</span>
                        {e.positionBids.map((p) => {
                          const active = bids[e.keyword] === p.bid;
                          return (
                            <button
                              key={p.position}
                              type="button"
                              onClick={() => applyPosition(e.keyword, p.position)}
                              disabled={positionLoading[e.keyword]}
                              className={cn(
                                "rounded-[var(--radius-full)] border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                active
                                  ? "border-[var(--color-blue-500)] bg-[var(--color-blue-50)] text-[var(--color-blue-600)]"
                                  : "border-[var(--border-subtle)] text-[var(--color-gray-500)] hover:border-[var(--color-blue-500)]"
                              )}
                            >
                              {p.position}위 {formatCompactKRW(p.bid)}원
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
                      <span className="text-[11px] text-[var(--color-gray-400)]">직접 순위 입력</span>
                      <input
                        type="number"
                        min={1}
                        value={customPosition[e.keyword] ?? ""}
                        onChange={(ev) => setCustomPosition((prev) => ({ ...prev, [e.keyword]: ev.target.value }))}
                        placeholder="예: 7"
                        className="w-14 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[11px] outline-none focus:border-[var(--color-blue-500)]"
                      />
                      <span className="text-[11px] text-[var(--color-gray-400)]">위</span>
                      <button
                        type="button"
                        disabled={!customPosition[e.keyword] || positionLoading[e.keyword]}
                        onClick={() => applyPosition(e.keyword, Number(customPosition[e.keyword]))}
                        className="rounded-[var(--radius-full)] border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-gray-500)] hover:border-[var(--color-blue-500)] disabled:opacity-40"
                      >
                        확인
                      </button>
                      {positionLoading[e.keyword] && (
                        <span className="text-[11px] text-[var(--color-gray-400)]">계산 중…</span>
                      )}
                      {!positionLoading[e.keyword] &&
                        Number(customPosition[e.keyword]) > 0 &&
                        bids[e.keyword] &&
                        positionCost[e.keyword] && (
                          <span className="text-[11px] text-[var(--color-blue-600)]">
                            → 입찰가 {formatKRW(bids[e.keyword])}원 · 일 {formatCompactKRW(positionCost[e.keyword].cost)}원 예상
                          </span>
                        )}
                    </div>
                  </div>
                ))}
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[12px] font-semibold text-[var(--color-gray-900)]">
                <span>설정 단가 기준 하루 예상 총 비용</span>
                <span>{formatKRW(computeTotal(positionCost))}원</span>
              </div>
            </div>
          )}
        </div>
      )}

      {onConfirm && (
        <Button type="button" size="md" onClick={onConfirm} className="self-start">
          {confirmLabel}
        </Button>
      )}
    </div>
  );
}
