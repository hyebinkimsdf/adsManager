/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import { HiCheck, HiExclamationTriangle } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { isApplicableAction } from "@/lib/ai/applyAction";
import { useCampaign } from "@/lib/mock/store";
import { isValidDailyBudget, MIN_DAILY_BUDGET, MAX_DAILY_BUDGET } from "@/lib/campaigns/validate";
import { formatKRW } from "@/lib/format";
import type { AssistantAction } from "@/lib/ai/types";

const riskLabel: Record<AssistantAction["riskLevel"], { label: string; tone: "gray" | "blue" | "red" }> = {
  low: { label: "가벼운 변경", tone: "gray" },
  medium: { label: "확인 필요", tone: "blue" },
  high: { label: "신중한 결정", tone: "red" },
};

export function ActionProposalCard({
  action,
  onApply,
}: {
  action: AssistantAction;
  onApply: (action: AssistantAction) => Promise<void>;
}) {
  const [status, setStatus] = useState<"pending" | "applying" | "applied" | "error" | "dismissed">("pending");
  const [error, setError] = useState<string | null>(null);
  const applicable = isApplicableAction(action);
  const risk = riskLabel[action.riskLevel];

  // 항상 최신 저장값을 기준으로 전후 금액을 다시 계산한다 — 제안이 만들어진 뒤 값이 바뀌어도
  // 화면에 보이는 "변경 전" 금액이 실제 현재 값과 어긋나지 않게 하기 위함.
  const campaign = useCampaign(action.campaignId ?? "");
  const currentBudget = campaign?.dailyBudget;
  const nextBudget =
    action.type === "adjust_budget" && currentBudget !== undefined
      ? action.targetAmount ?? Math.max(0, Math.round(currentBudget * (1 + (action.percent ?? 0) / 100)))
      : undefined;
  const budgetOutOfRange = nextBudget !== undefined && !isValidDailyBudget(nextBudget);

  async function handleApply() {
    setStatus("applying");
    setError(null);
    try {
      await onApply(action);
      setStatus("applied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "적용하지 못했어요.");
      setStatus("error");
    }
  }

  return (
    <div
      css={css`
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        background: white;
        padding: 0.875rem;
      `}
    >
      <div css={{ marginBottom: "0.375rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>{action.label}</span>
        <Badge tone={risk.tone}>{risk.label}</Badge>
      </div>
      <p css={{ marginBottom: "0.75rem", fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
        {action.description}
      </p>
      {currentBudget !== undefined && nextBudget !== undefined && (
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            border-radius: var(--radius-sm);
            background: var(--color-gray-50);
            padding: 0.625rem 0.75rem;
            margin-bottom: 0.75rem;
          `}
        >
          <span css={{ fontSize: 12.5, color: "var(--color-gray-500)" }}>일 예산</span>
          <div css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span css={{ fontSize: 13, color: "var(--color-gray-500)" }}>{formatKRW(currentBudget)}원</span>
            <span css={{ fontSize: 13, color: "var(--color-gray-400)" }} aria-hidden="true">
              →
            </span>
            <span
              css={{
                fontSize: 14,
                fontWeight: 700,
                color: budgetOutOfRange ? "var(--color-red-500)" : "var(--color-gray-900)",
              }}
            >
              {formatKRW(nextBudget)}원
            </span>
          </div>
        </div>
      )}
      {budgetOutOfRange && (
        <p css={{ marginTop: "-0.375rem", marginBottom: "0.75rem", fontSize: 12.5, color: "var(--color-red-500)" }}>
          일 예산은 {formatKRW(MIN_DAILY_BUDGET)}원~{formatKRW(MAX_DAILY_BUDGET)}원 사이여야 해요.
        </p>
      )}
      {applicable && (status === "pending" || status === "applying") && (
        <div css={{ display: "flex", gap: "0.5rem" }}>
          <Button size="sm" variant="primary" onClick={handleApply} disabled={status === "applying" || budgetOutOfRange}>
            {status === "applying" ? "적용 중…" : "적용"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatus("dismissed")} disabled={status === "applying"}>
            무시
          </Button>
        </div>
      )}
      {applicable && status === "applied" && (
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
          <HiCheck style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 적용했어요
        </p>
      )}
      {applicable && status === "error" && (
        <div>
          <p
            css={{
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-red-600)",
            }}
          >
            <HiExclamationTriangle style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
            {error}
          </p>
          <Button size="sm" variant="primary" onClick={handleApply}>
            다시 시도
          </Button>
        </div>
      )}
      {status === "dismissed" && <p css={{ fontSize: 13, color: "var(--color-gray-400)" }}>무시했어요</p>}
    </div>
  );
}
