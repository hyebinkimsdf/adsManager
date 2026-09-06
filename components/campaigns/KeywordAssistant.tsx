/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { HiSparkles, HiXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { AvailabilityBanner } from "@/components/assistant/AvailabilityBanner";
import { ChatBubble } from "@/components/assistant/ChatBubble";
import { useKeywordAssistant } from "@/lib/ai/useKeywordAssistant";
import {
  fetchKeywordBidEstimates,
  fetchPositionEstimate,
  type KeywordBidEstimateDto,
} from "@/lib/ai/naverBidClient";
import { formatCompactKRW, formatKRW } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { KeywordSuggestion } from "@/lib/ai/types";
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

type ScaleKey = "small" | "medium" | "bulk";

const SCALE_OPTIONS: {
  key: ScaleKey;
  label: string;
  note: string;
  limit: number;
  recommended?: boolean;
}[] = [
  { key: "small", label: "적게", note: "핵심 위주로 좁게, 관리가 쉬워요", limit: 8 },
  { key: "medium", label: "추천", note: "적당히 넓게, 균형 잡힌 선택이에요", limit: 30, recommended: true },
  { key: "bulk", label: "많이", note: "최대한 넓게, 관리 손이 많이 가요", limit: 300 },
];

const BUDGET_STATUS = {
  under: { tone: "green" as const, label: "여유 있어요" },
  fit: { tone: "blue" as const, label: "예산에 딱 맞아요" },
  over: { tone: "red" as const, label: "예산을 넘어요" },
};

const SUB_PREVIEW_COUNT = 40;

const inputStyle = css`
  flex: 1;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: white;
  padding: 0.625rem 0.875rem;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: var(--color-blue-500);
  }
`;

const linkButtonStyle = css`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-blue-600);
  &:hover {
    text-decoration: underline;
  }
`;

const keywordChipStyle = (active: boolean) => css`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 9999px;
  border: 1px solid ${active ? "var(--color-blue-500)" : "var(--border-subtle)"};
  background-color: ${active ? "var(--color-blue-50)" : "white"};
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-700)"};
  padding: 0.375rem 0.75rem;
  font-size: 13px;
  font-weight: 500;
  transition: border-color 150ms;

  ${!active &&
  `
    &:hover {
      border-color: var(--color-blue-500);
    }
  `}
`;

const chipMetaStyle = css`
  border-radius: 9999px;
  background-color: var(--color-gray-100);
  padding: 0.125rem 0.375rem;
  font-size: 10px;
  color: var(--color-gray-500);
`;

const positionChipStyle = (active: boolean) => css`
  border-radius: 9999px;
  border: 1px solid ${active ? "var(--color-blue-500)" : "var(--border-subtle)"};
  background-color: ${active ? "var(--color-blue-50)" : "transparent"};
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-500)"};
  padding: 0.125rem 0.5rem;
  font-size: 11px;
  font-weight: 500;
  transition: border-color 150ms;

  ${!active &&
  `
    &:hover {
      border-color: var(--color-blue-500);
    }
  `}
`;

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
  dailyBudget = null,
  targetPosition = 3,
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
  /** 하루 예산(원). 지정하면 AI가 이 예산 안에서 자동으로 키워드를 담아준다. */
  dailyBudget?: number | null;
  /** 원하는 노출 순위(1/3/5). 자동 담기 시 이 순위 기준 입찰가로 비용을 계산한다. */
  targetPosition?: number;
}) {
  const { state, downloadProgress, suggest } = useKeywordAssistant();
  const [kwStep, setKwStep] = useState<"core" | "scale" | "review">("core");
  const [draft, setDraft] = useState("");
  const [bids, setBids] = useState<Record<string, number>>({});
  const [positionCost, setPositionCost] = useState<Record<string, { clicks: number; cost: number }>>({});
  const [positionLoading, setPositionLoading] = useState<Record<string, boolean>>({});
  const [customPosition, setCustomPosition] = useState<Record<string, string>>({});
  const [scale, setScale] = useState<ScaleKey>("medium");
  const [subExpanded, setSubExpanded] = useState(false);
  const [coreKeywordInput, setCoreKeywordInput] = useState("");

  const bidEstimatesMutation = useMutation({
    mutationFn: (keywords: string[]) => fetchKeywordBidEstimates(keywords),
  });
  const positionMutation = useMutation({
    mutationFn: (vars: { keyword: string; position: number }) =>
      fetchPositionEstimate(vars.keyword, vars.position),
  });
  const bidEstimates = bidEstimatesMutation.data ?? null;
  const bidsLoading = bidEstimatesMutation.isPending;
  const bidsAsked = bidEstimatesMutation.isSuccess;

  const suggestMutation = useMutation({
    mutationFn: (vars: { coreKeyword: string; limit: number }) =>
      suggest({ objective, channels, industry, name, coreKeyword: vars.coreKeyword }, { limit: vars.limit }),
    onSuccess: async (result) => {
      if (result.engine === "naver-ads" && dailyBudget) {
        await autoSelectWithinBudget(result.reply.keywords, dailyBudget);
      }
    },
  });
  const suggestions = suggestMutation.data?.reply.keywords ?? [];
  const engine = suggestMutation.data?.engine ?? null;
  const loading = suggestMutation.isPending;
  const hasAsked = suggestMutation.isSuccess;

  const coreSuggestions = suggestions.filter((s) => s.tier !== "sub");
  const subSuggestions = suggestions.filter((s) => s.tier === "sub");

  // 각 키워드의 중간 입찰가 기준 예상치를, 목표 순위의 입찰가 비율만큼 근사해서 환산한다.
  // (순위별 클릭·비용을 매번 새로 조회하지 않고, 이미 받아온 데이터로 계산)
  function estimateForPosition(e: KeywordBidEstimateDto, position: number) {
    const posBid = e.positionBids.find((p) => p.position === position)?.bid ?? e.medianBid;
    const ratio = e.medianBid > 0 ? posBid / e.medianBid : 1;
    // 검색량이 낮은 롱테일 키워드는 네이버 성과 예측(클릭·비용)이 데이터 부족으로 0을 주는 경우가 많다.
    // 그대로 두면 "공짜"로 착각해 무제한으로 담게 되므로, 하루 1클릭은 발생한다고 가정한 입찰가를 하한선으로 쓴다.
    const cost = e.estimatedDailyCost > 0 ? e.estimatedDailyCost * ratio : posBid;
    const clicks = e.estimatedDailyClicks > 0 ? e.estimatedDailyClicks * ratio : 1;
    return { bid: posBid, cost, clicks };
  }

  // 실검색 데이터(네이버) 기반 추천이고 예산이 주어졌을 때만 자동으로 담는다.
  // 핵심 키워드는 사용자가 직접 입력한 키워드이므로 비용과 무관하게 항상 담고,
  // 남은 예산은 서브 키워드를 저렴한 것부터 채워서 최대한 여러 개가 담기게 한다.
  // (검색량 순으로만 담으면 비싼 키워드 한둘이 예산을 다 써버려 서브 키워드가 거의 안 담긴다)
  async function autoSelectWithinBudget(list: KeywordSuggestion[], budget: number) {
    const estimates = await bidEstimatesMutation.mutateAsync(list.map((s) => s.keyword));
    if (!estimates || estimates.length === 0) return;

    const estByKeyword = new Map(estimates.map((e) => [e.keyword, e]));
    const withCost = list
      .map((s) => {
        const est = estByKeyword.get(s.keyword);
        if (!est) return null;
        return { s, ...estimateForPosition(est, targetPosition) };
      })
      .filter((x): x is { s: KeywordSuggestion; bid: number; cost: number; clicks: number } => x !== null);

    const core = withCost.filter((x) => x.s.tier !== "sub");
    const subs = withCost.filter((x) => x.s.tier === "sub").sort((a, b) => a.cost - b.cost);

    const nextBids: Record<string, number> = {};
    const picked: string[] = [];
    let total = 0;
    for (const { s, bid, cost } of core) {
      picked.push(s.keyword);
      nextBids[s.keyword] = bid;
      total += cost;
    }
    for (const { s, bid, cost } of subs) {
      if (picked.length === 0 || total + cost <= budget) {
        picked.push(s.keyword);
        nextBids[s.keyword] = bid;
        total += cost;
      }
    }

    onChange(picked);
    setBids(nextBids);
    onBidsChange?.(nextBids);
    onBudgetEstimate?.(total);
  }

  function handleSuggest(scaleOverride?: ScaleKey) {
    const coreKeyword = coreKeywordInput.trim();
    if (!coreKeyword) return;
    setSubExpanded(false);
    bidEstimatesMutation.reset();
    setPositionCost({});
    const activeScale = scaleOverride ?? scale;
    const limit = SCALE_OPTIONS.find((o) => o.key === activeScale)!.limit;
    suggestMutation.mutate({ coreKeyword, limit });
  }

  function submitCoreKeyword() {
    if (!coreKeywordInput.trim()) return;
    setKwStep("scale");
  }

  function chooseScale(key: ScaleKey) {
    setScale(key);
    setKwStep("review");
    handleSuggest(key);
  }

  async function handleEstimateBids() {
    setPositionCost({});
    const result = await bidEstimatesMutation.mutateAsync(selected);
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
  // 여러 키워드에 대해 동시에 순위를 조회할 수 있어 로딩 상태는 키워드별로 따로 추적한다
  // (단일 useMutation 인스턴스의 isPending은 마지막 호출 기준이라 동시 호출을 구분하지 못함).
  async function applyPosition(keyword: string, position: number) {
    setPositionLoading((prev) => ({ ...prev, [keyword]: true }));
    const result = await positionMutation.mutateAsync({ keyword, position });
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
      <button key={s.keyword} type="button" onClick={() => toggle(s.keyword)} css={keywordChipStyle(active)}>
        {s.keyword}
        {s.monthlySearches !== undefined ? (
          <>
            <span css={chipMetaStyle}>월 {formatCompactKRW(s.monthlySearches)}회</span>
            {s.competition && (
              <Badge tone={COMPETITION_TONE[s.competition]} css={{ padding: "0.125rem 0.375rem", fontSize: 10 }}>
                {COMPETITION_LABEL[s.competition]}
              </Badge>
            )}
          </>
        ) : (
          <span css={chipMetaStyle}>{MATCH_TYPE_LABEL[s.matchType]}</span>
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

  const summary = (() => {
    if (!bidEstimates) return null;
    const rows = bidEstimates.filter((e) => selected.includes(e.keyword));
    if (rows.length === 0) return null;
    let cost = 0;
    let clicks = 0;
    for (const e of rows) {
      const override = positionCost[e.keyword];
      if (override) {
        cost += override.cost;
        clicks += override.clicks;
      } else {
        const est = estimateForPosition(e, targetPosition);
        cost += est.cost;
        clicks += est.clicks;
      }
    }
    const status: keyof typeof BUDGET_STATUS | null =
      dailyBudget == null ? null : cost <= dailyBudget * 0.9 ? "under" : cost <= dailyBudget * 1.1 ? "fit" : "over";
    return { cost, clicks, count: rows.length, status };
  })();

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <ChatBubble role="assistant">핵심 키워드가 뭔가요?</ChatBubble>
      {kwStep === "core" ? (
        <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div css={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={coreKeywordInput}
              onChange={(e) => setCoreKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCoreKeyword();
                }
              }}
              placeholder="예: 강남 필라테스"
              css={inputStyle}
            />
            <Button type="button" size="md" disabled={!coreKeywordInput.trim()} onClick={submitCoreKeyword}>
              다음
            </Button>
          </div>
          <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>
            입력한 키워드에 위치·가격·상담 등을 조합해 실제 입찰 가능한 서브 키워드로 확장해요
          </span>
        </div>
      ) : (
        <ChatBubble role="user" onClick={() => setKwStep("core")}>
          {coreKeywordInput}
        </ChatBubble>
      )}

      {kwStep !== "core" && (
        <>
          <ChatBubble role="assistant">몇 개 정도 추천받을까요?</ChatBubble>
          {kwStep === "scale" ? (
            <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <div css={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {SCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => chooseScale(opt.key)}
                    css={css`
                      display: flex;
                      flex-direction: column;
                      gap: 0.125rem;
                      border-radius: var(--radius-md);
                      border: 1px solid var(--border-subtle);
                      padding: 0.625rem 0.875rem;
                      text-align: left;
                      transition: border-color 150ms, background-color 150ms;

                      &:hover {
                        border-color: var(--color-blue-500);
                        background-color: var(--color-blue-50);
                      }
                    `}
                  >
                    <span css={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>
                      {opt.label}
                      {opt.recommended && (
                        <Badge tone="blue" css={{ padding: "0 0.375rem", fontSize: 9 }}>
                          추천
                        </Badge>
                      )}
                    </span>
                    <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>{opt.note}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ChatBubble role="user" onClick={() => setKwStep("scale")}>
              {SCALE_OPTIONS.find((o) => o.key === scale)?.label}
            </ChatBubble>
          )}
        </>
      )}

      {kwStep === "review" && (
        <>
          <ChatBubble role="assistant">
            {loading
              ? "키워드를 준비하고 있어요..."
              : "예산과 순위에 맞게 키워드를 담아봤어요. 필요하면 빼거나 더해주세요."}
          </ChatBubble>

          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
              border-radius: var(--radius-md);
              border: 1px solid var(--border-subtle);
              background-color: var(--color-gray-50);
              padding: 0.875rem;
            `}
          >
            {!loading && suggestions.length > 0 && (
              <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => handleSuggest()}
                  css={css`
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--color-blue-600);
                    &:hover {
                      text-decoration: underline;
                    }
                  `}
                >
                  <HiSparkles style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
                  다시 추천받기
                </button>
                <div css={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {subSuggestions.length > 0 && (
                    <button type="button" onClick={applyCoreOnly} css={linkButtonStyle}>
                      핵심만 적용
                    </button>
                  )}
                  <button type="button" onClick={applyAllSuggested} css={linkButtonStyle}>
                    추천 전체 적용
                  </button>
                </div>
              </div>
            )}

            {hasAsked && !loading && engine === "naver-ads" && (
              <div css={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0 0.25rem", fontSize: 12, color: "var(--color-gray-500)" }}>
                <Badge tone="green">실검색 데이터</Badge>
                <span>네이버 검색광고의 월간 검색수·경쟁정도를 기반으로 추천해요</span>
              </div>
            )}
            {hasAsked && !loading && engine !== "naver-ads" && (
              <AvailabilityBanner state={state} downloadProgress={downloadProgress} />
            )}

            {loading && (
              <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} css={{ height: "2rem", width: "5rem" }} />
                ))}
              </div>
            )}

            {!loading && suggestions.length > 0 && (
              <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {subSuggestions.length === 0 ? (
                  <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>{coreSuggestions.map(renderKeywordChip)}</div>
                ) : (
                  <>
                    <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <span css={{ fontSize: 11, fontWeight: 600, color: "var(--color-gray-500)" }}>
                        핵심 키워드 ({coreSuggestions.length})
                      </span>
                      <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>{coreSuggestions.map(renderKeywordChip)}</div>
                    </div>
                    <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <span css={{ fontSize: 11, fontWeight: 600, color: "var(--color-gray-500)" }}>
                        서브 키워드 ({subSuggestions.length})
                      </span>
                      <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {(subExpanded ? subSuggestions : subSuggestions.slice(0, SUB_PREVIEW_COUNT)).map(
                          renderKeywordChip
                        )}
                      </div>
                      {subSuggestions.length > SUB_PREVIEW_COUNT && (
                        <button
                          type="button"
                          onClick={() => setSubExpanded((v) => !v)}
                          css={[linkButtonStyle, css`align-self: flex-start;`]}
                        >
                          {subExpanded ? "접기" : `서브 키워드 ${subSuggestions.length - SUB_PREVIEW_COUNT}개 더보기`}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div css={{ display: "flex", gap: "0.5rem" }}>
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
                css={inputStyle}
              />
              <Button type="button" size="md" variant="secondary" disabled={!draft.trim()} onClick={addCustom}>
                추가
              </Button>
            </div>

            {selected.length > 0 && (
              <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {selected.map((k) => (
                  <span
                    key={k}
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.25rem;
                      border-radius: 9999px;
                      background-color: var(--color-blue-50);
                      padding: 0.25rem 0.375rem 0.25rem 0.625rem;
                      font-size: 12px;
                      font-weight: 500;
                      color: var(--color-blue-600);
                    `}
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() => toggle(k)}
                      aria-label={`${k} 제거`}
                      css={css`
                        border-radius: 9999px;
                        padding: 0.125rem;
                        &:hover {
                          background-color: var(--color-blue-100);
                        }
                      `}
                    >
                      <HiXMark style={{ height: "0.75rem", width: "0.75rem" }} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {summary && (
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.375rem;
                  border-radius: var(--radius-sm);
                  border: 1px solid var(--border-subtle);
                  background: white;
                  padding: 0.75rem;
                `}
              >
                <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>AI 추천 요약</span>
                  {summary.status && (
                    <Badge tone={BUDGET_STATUS[summary.status].tone}>{BUDGET_STATUS[summary.status].label}</Badge>
                  )}
                </div>
                <p css={{ fontSize: 12, color: "var(--color-gray-600)" }}>
                  선택한 키워드 {summary.count}개 · 하루 약 {formatCompactKRW(summary.clicks)}번 클릭될 것으로 예상돼요
                </p>
                <p css={{ fontSize: 12, color: "var(--color-gray-600)" }}>
                  하루 예상 비용 약 {formatKRW(summary.cost)}원
                  {dailyBudget != null && <> (예산 {formatKRW(dailyBudget)}원 중)</>}
                </p>
              </div>
            )}

            {selected.length > 0 && (
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.5rem;
                  border-radius: var(--radius-sm);
                  border: 1px solid var(--border-subtle);
                  background: white;
                  padding: 0.75rem;
                `}
              >
                <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>키워드별 단가 · 예상 예산</span>
                  <Button type="button" size="sm" variant="secondary" onClick={handleEstimateBids} disabled={bidsLoading}>
                    {bidsAsked ? "다시 계산" : "예상 단가 확인"}
                  </Button>
                </div>

                {bidsLoading && (
                  <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {selected.map((k) => (
                      <Skeleton key={k} css={{ height: "2.25rem", width: "100%" }} />
                    ))}
                  </div>
                )}

                {!bidsLoading && bidsAsked && !bidEstimates && (
                  <p css={{ fontSize: 12, color: "var(--color-gray-500)" }}>
                    네이버 검색광고 API 연동이 안 돼 있어 단가를 예측할 수 없어요. 예산은 직접 정해주세요.
                  </p>
                )}

                {!bidsLoading && bidEstimates && (
                  <div css={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {bidEstimates
                      .filter((e) => selected.includes(e.keyword))
                      .map((e, i, arr) => (
                        <div
                          key={e.keyword}
                          css={css`
                            display: flex;
                            flex-direction: column;
                            gap: 0.25rem;
                            padding-bottom: 0.5rem;
                            ${i < arr.length - 1 && "border-bottom: 1px solid var(--border-subtle);"}
                          `}
                        >
                          <div css={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12 }}>
                            <span
                              css={css`
                                min-width: 0;
                                flex: 1;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                                font-weight: 500;
                                color: var(--color-gray-700);
                              `}
                            >
                              {e.keyword}
                            </span>
                            <span css={{ flexShrink: 0, color: "var(--color-gray-400)" }}>최소 {formatKRW(e.minBid)}원</span>
                            <input
                              type="number"
                              value={bids[e.keyword] ?? e.medianBid}
                              onChange={(ev) => updateBid(e.keyword, Number(ev.target.value))}
                              css={css`
                                width: 6rem;
                                flex-shrink: 0;
                                border-radius: var(--radius-sm);
                                border: 1px solid var(--border-subtle);
                                padding: 0.25rem 0.5rem;
                                text-align: right;
                                outline: none;
                                &:focus {
                                  border-color: var(--color-blue-500);
                                }
                              `}
                            />
                            <span css={{ flexShrink: 0, color: "var(--color-gray-400)" }}>원</span>
                            <span css={{ flexShrink: 0, color: "var(--color-gray-400)" }}>
                              일 {formatCompactKRW(costOf(e))}원 예상
                            </span>
                          </div>
                          {e.positionBids.length > 0 && (
                            <div css={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.375rem", paddingLeft: "0.125rem" }}>
                              <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>순위별 입찰가</span>
                              {e.positionBids.map((p) => {
                                const active = bids[e.keyword] === p.bid;
                                return (
                                  <button
                                    key={p.position}
                                    type="button"
                                    onClick={() => applyPosition(e.keyword, p.position)}
                                    disabled={positionLoading[e.keyword]}
                                    css={positionChipStyle(active)}
                                  >
                                    {p.position}위 {formatCompactKRW(p.bid)}원
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div css={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.375rem", paddingLeft: "0.125rem" }}>
                            <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>직접 순위 입력</span>
                            <input
                              type="number"
                              min={1}
                              value={customPosition[e.keyword] ?? ""}
                              onChange={(ev) =>
                                setCustomPosition((prev) => ({ ...prev, [e.keyword]: ev.target.value }))
                              }
                              placeholder="예: 7"
                              css={css`
                                width: 3.5rem;
                                border-radius: var(--radius-sm);
                                border: 1px solid var(--border-subtle);
                                padding: 0.125rem 0.375rem;
                                font-size: 11px;
                                outline: none;
                                &:focus {
                                  border-color: var(--color-blue-500);
                                }
                              `}
                            />
                            <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>위</span>
                            <button
                              type="button"
                              disabled={!customPosition[e.keyword] || positionLoading[e.keyword]}
                              onClick={() => applyPosition(e.keyword, Number(customPosition[e.keyword]))}
                              css={css`
                                border-radius: 9999px;
                                border: 1px solid var(--border-subtle);
                                padding: 0.125rem 0.5rem;
                                font-size: 11px;
                                font-weight: 500;
                                color: var(--color-gray-500);
                                &:hover {
                                  border-color: var(--color-blue-500);
                                }
                                &:disabled {
                                  opacity: 0.4;
                                }
                              `}
                            >
                              확인
                            </button>
                            {positionLoading[e.keyword] && (
                              <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>계산 중…</span>
                            )}
                            {!positionLoading[e.keyword] &&
                              Number(customPosition[e.keyword]) > 0 &&
                              bids[e.keyword] &&
                              positionCost[e.keyword] && (
                                <span css={{ fontSize: 11, color: "var(--color-blue-600)" }}>
                                  → 입찰가 {formatKRW(bids[e.keyword])}원 · 일{" "}
                                  {formatCompactKRW(positionCost[e.keyword].cost)}원 예상
                                </span>
                              )}
                          </div>
                        </div>
                      ))}
                    <div
                      css={css`
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-top: 1px solid var(--border-subtle);
                        padding-top: 0.5rem;
                        font-size: 12px;
                        font-weight: 600;
                        color: var(--color-gray-900);
                      `}
                    >
                      <span>설정 단가 기준 하루 예상 총 비용</span>
                      <span>{formatKRW(computeTotal(positionCost))}원</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {onConfirm && (
              <Button type="button" size="md" onClick={onConfirm} css={{ alignSelf: "flex-start" }}>
                {confirmLabel}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
