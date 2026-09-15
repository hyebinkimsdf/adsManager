/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useEffect, useRef, useState } from "react";
import { HiOutlineCheckCircle, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { SlideOver } from "@/components/ui/SlideOver";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OptionCard, OptionGrid } from "@/components/campaigns/OptionCard";
import { EngineBadge } from "@/components/dashboard/EngineBadge";
import { BUDGET_TIERS, nearestBudgetTier, budgetRangeForTier } from "@/lib/campaigns/budgetTiers";
import { findComparableCampaigns, decideBudgetRecommendation, templateBudgetReasoning, type BudgetRecommendationFacts } from "@/lib/campaigns/budgetRecommendation";
import { budgetCooldownStatus } from "@/lib/insights";
import { useBudgetRecommendation, type BudgetRecommendationExplanation } from "@/lib/ai/useBudgetRecommendation";
import { useCampaignsQuery, applyBudgetRecommendation } from "@/lib/mock/store";
import { formatKRW } from "@/lib/format";
import type { Campaign } from "@/lib/mock/types";

type Step = "range" | "loading" | "result";

export function BudgetRecommendationPanel({
  campaign,
  open,
  onClose,
}: {
  campaign: Campaign;
  open: boolean;
  onClose: () => void;
}) {
  // 닫으면 요청을 취소하고 상태를 폐기한다. 다시 열 때 최신 캠페인으로 시작한다.
  if (!open) return null;
  return <BudgetRecommendationContent key={campaign.id} campaign={campaign} onClose={onClose} />;
}

function BudgetRecommendationContent({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const campaignsQuery = useCampaignsQuery();
  const recommendedTier = nearestBudgetTier(campaign.dailyBudget);
  const [selectedTier, setSelectedTier] = useState(recommendedTier.daily);
  const [step, setStep] = useState<Step>("range");
  const [facts, setFacts] = useState<BudgetRecommendationFacts | null>(null);
  const [explanation, setExplanation] = useState<BudgetRecommendationExplanation | null>(null);
  const [applyState, setApplyState] = useState<"idle" | "applying" | "applied" | "error">("idle");
  const [applyError, setApplyError] = useState<string | null>(null);
  const { explain } = useBudgetRecommendation();
  const mounted = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const cooldown = budgetCooldownStatus(campaign, new Date());
  const selectedRange = budgetRangeForTier(selectedTier);
  const staleRecommendation = facts !== null && facts.currentBudget !== campaign.dailyBudget && applyState !== "applied";
  const canRecommend = campaignsQuery.isSuccess && !campaignsQuery.isFetching;

  function chooseRangeAgain() {
    setStep("range");
    setFacts(null);
    setExplanation(null);
    setApplyState("idle");
    setApplyError(null);
  }

  async function confirmRange() {
    if (busy.current || !canRecommend || cooldown.cooling) return;
    busy.current = true;
    setStep("loading");
    const range = budgetRangeForTier(selectedTier);
    const comparables = findComparableCampaigns(campaign, campaignsQuery.data);
    const decided = decideBudgetRecommendation(campaign, comparables, range);
    setFacts(decided);
    try {
      const result = await explain(decided);
      if (mounted.current) setExplanation(result);
    } catch {
      if (mounted.current) setExplanation({ reasoning: templateBudgetReasoning(decided), engine: "preview" });
    } finally {
      if (mounted.current) setStep("result");
      busy.current = false;
    }
  }

  async function apply() {
    if (busy.current || !facts || facts.direction === "flat" || staleRecommendation || cooldown.cooling) return;
    busy.current = true;
    setApplyState("applying");
    setApplyError(null);
    try {
      await applyBudgetRecommendation(campaign.id, facts.recommendedBudget, facts.direction === "up" ? "raise_budget" : "lower_budget");
      if (mounted.current) setApplyState("applied");
    } catch (err) {
      if (mounted.current) {
        setApplyState("error");
        setApplyError(err instanceof Error ? err.message : "적용하지 못했어요.");
      }
    } finally {
      busy.current = false;
    }
  }

  return (
    <SlideOver open onClose={onClose} title="AI 예산 추천">
      {cooldown.cooling && applyState !== "applied" ? (
        <p css={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--color-gray-600)" }}>{cooldown.message}</p>
      ) : step === "range" ? (
        <div css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p css={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--color-gray-600)" }}>
            예산 범위를 골라주세요. 목표와 타겟 조건이 비슷하고 매출 대비 광고비 성과가 확인된 캠페인의 예산을 참고해 추천해드릴게요.
          </p>
          <OptionGrid columns={3}>
            {BUDGET_TIERS.map((tier) => (
              <OptionCard
                key={tier.daily}
                icon={tier.icon}
                iconBg={tier.bg}
                iconColor={tier.color}
                label={tier.label}
                badge={tier.daily === recommendedTier.daily ? "추천" : undefined}
                active={selectedTier === tier.daily}
                desc={tier.note}
                onClick={() => setSelectedTier(tier.daily)}
              />
            ))}
          </OptionGrid>
          <p css={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--color-gray-600)" }}>
            지금 일 예산: {formatKRW(campaign.dailyBudget)}원<br />
            선택한 범위: 일 {formatKRW(selectedRange.min)}원 ~ {formatKRW(selectedRange.max)}원
          </p>
          {campaignsQuery.isError ? (
            <div role="alert" css={{ fontSize: 13, color: "var(--color-red-500)" }}>
              비교할 캠페인을 불러오지 못했어요.
              <Button variant="secondary" onClick={() => void campaignsQuery.refetch()} disabled={campaignsQuery.isFetching}>다시 불러오기</Button>
            </div>
          ) : !canRecommend ? (
            <p role="status" css={{ fontSize: 13, color: "var(--color-gray-600)" }}>비교할 캠페인을 불러오고 있어요...</p>
          ) : null}
          <Button onClick={confirmRange} disabled={!canRecommend}>이 범위로 추천받기</Button>
        </div>
      ) : step === "loading" ? (
        <p css={{ fontSize: 13.5, color: "var(--color-gray-600)" }}>비슷한 캠페인을 살펴보고 있어요...</p>
      ) : facts && explanation ? (
        <div css={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div css={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            <EngineBadge engine={explanation.engine} />
            {facts.comparableCount > 0 && <Badge tone="gray">비슷한 캠페인 {facts.comparableCount}건 참고</Badge>}
          </div>
          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 0.5rem;
              border-radius: var(--radius-sm);
              background: var(--color-gray-50);
              padding: 0.75rem 0.875rem;
            `}
          >
            <span css={{ fontSize: 12.5, color: "var(--color-gray-600)" }}>일 예산</span>
            <div css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span css={{ fontSize: 13, color: "var(--color-gray-600)" }}>{formatKRW(facts.currentBudget)}원</span>
              <span css={{ fontSize: 13, color: "var(--color-gray-400)" }} aria-hidden="true">
                →
              </span>
              <span css={{ fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>{formatKRW(facts.recommendedBudget)}원</span>
            </div>
          </div>
          <p css={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--color-gray-700)" }}>{explanation.reasoning}</p>

          {staleRecommendation && applyState !== "applying" ? (
            <p role="alert" css={{ fontSize: 13, color: "var(--color-gray-600)" }}>현재 예산이 바뀌었어요. 범위를 다시 고르고 추천받아주세요.</p>
          ) : facts.direction === "flat" ? (
            <p css={{ fontSize: 13, color: "var(--color-gray-600)" }}>현재 예산을 유지하는 추천이에요.</p>
          ) : applyState === "applied" ? (
            <p
              css={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-green-600)",
              }}
            >
              <HiOutlineCheckCircle style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 적용했어요
            </p>
          ) : (
            <div css={{ display: "flex", gap: "0.5rem" }}>
              <Button size="md" onClick={apply} disabled={applyState === "applying" || staleRecommendation}>
                {applyState === "applying" ? "적용 중..." : "적용"}
              </Button>
            </div>
          )}
          {applyState !== "applied" && (
            <Button size="md" variant="secondary" onClick={chooseRangeAgain} disabled={applyState === "applying"}>
              범위 다시 고르기
            </Button>
          )}
          {applyState === "error" && (
            <p css={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: 12.5, color: "var(--color-red-500)" }}>
              <HiOutlineExclamationTriangle style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
              {applyError}
            </p>
          )}
        </div>
      ) : null}
    </SlideOver>
  );
}
