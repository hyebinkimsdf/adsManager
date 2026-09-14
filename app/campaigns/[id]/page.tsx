/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { HiCheck, HiExclamationTriangle, HiSparkles } from "react-icons/hi2";
import { useCampaign, useBudgetAdjustmentsQuery } from "@/lib/mock/store";
import { updateBudget, setStatus, updateIndustry, deleteCampaign } from "@/lib/mock/store";
import { sumHistory, OBJECTIVE_LABEL, INDUSTRY_LABEL } from "@/lib/mock/campaigns";
import { isValidDailyBudget, MIN_DAILY_BUDGET, MAX_DAILY_BUDGET } from "@/lib/campaigns/validate";
import { formatCompactKRW, formatKRW, formatPercent, formatSignedPercent, formatDateTime } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { LineChart } from "@/components/dashboard/LineChart";
import { openAssistantDock } from "@/lib/ui/assistantDock";
import { campaignStateLabel } from "@/lib/campaigns/list";
import type { CampaignIndustry } from "@/lib/mock/types";

const INDUSTRY_KEYS = Object.keys(INDUSTRY_LABEL) as CampaignIndustry[];

const REASON_LABEL: Record<"lower_budget" | "raise_budget", string> = {
  lower_budget: "예산 절감 추천 적용",
  raise_budget: "예산 증액 추천 적용",
};

const VERDICT_COLOR: Record<"improved" | "worsened" | "flat", string> = {
  improved: "var(--color-green-600)",
  worsened: "var(--color-red-600)",
  flat: "var(--color-gray-500)",
};

/** 예산을 바꿀 때마다(추천 적용/직접 수정) 남긴 기록과, 실데이터로 확인된 효과를 함께 보여준다. */
function BudgetAdjustmentHistory({ campaignId }: { campaignId: string }) {
  const { data, isPending, isError, refetch } = useBudgetAdjustmentsQuery(campaignId);
  const items = data?.items ?? [];

  // 변경 이력이 아예 없으면(아직 한 번도 예산을 안 바꿨으면) 섹션 자체를 보여주지 않는다.
  if (!isPending && !isError && items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>예산 변경 이력</CardTitle>
      </CardHeader>
      {isPending && <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>불러오는 중...</p>}
      {isError && (
        <div css={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <p css={{ fontSize: 13, color: "var(--color-red-600)" }}>변경 이력을 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => refetch()}
            css={css`
              font-size: 12.5px;
              font-weight: 600;
              color: var(--color-blue-600);
            `}
          >
            다시 시도
          </button>
        </div>
      )}
      {!isPending && !isError && (
        <div css={{ display: "flex", flexDirection: "column" }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              css={css`
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
                padding: 0.75rem 0;
                ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
              `}
            >
              <div css={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem" }}>
                <p css={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-gray-900)" }}>
                  {formatKRW(item.previousBudget)}원 → {formatKRW(item.newBudget)}원
                  {item.percent != null && (
                    <span css={{ marginLeft: "0.375rem", fontWeight: 500, color: "var(--color-gray-500)" }}>
                      ({formatSignedPercent(item.percent, 0)})
                    </span>
                  )}
                </p>
                <span css={{ flexShrink: 0, fontSize: 12, color: "var(--color-gray-400)" }}>{formatDateTime(item.createdAt)}</span>
              </div>
              <p css={{ fontSize: 12.5, color: "var(--color-gray-500)" }}>
                {item.source === "recommendation" && item.reasonKind ? REASON_LABEL[item.reasonKind] : "캠페인 상세에서 직접 수정"}
              </p>
              <p
                css={{
                  fontSize: 12.5,
                  color: item.effect.verdict ? VERDICT_COLOR[item.effect.verdict] : "var(--color-gray-500)",
                }}
              >
                {item.effect.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaign = useCampaign(params.id);
  const [budgetInput, setBudgetInput] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!campaign) {
    return (
      <div
        css={css`
          border-radius: var(--radius-lg);
          background: white;
          padding: 2.5rem;
          text-align: center;
          box-shadow: var(--shadow-card);
        `}
      >
        <p css={{ fontSize: 14, color: "var(--color-gray-600)" }}>캠페인을 찾을 수 없어요.</p>
        <Link href="/campaigns" css={{ marginTop: "0.75rem", display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--color-blue-600)" }}>
          캠페인 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const totals = sumHistory(campaign.history);
  const editingValue = budgetInput ?? String(campaign.dailyBudget);
  const parsedBudget = Number(editingValue.replace(/[^0-9]/g, ""));
  const budgetError =
    editingValue.trim() === ""
      ? "일 예산을 입력해주세요."
      : !isValidDailyBudget(parsedBudget)
      ? `일 예산은 ${formatKRW(MIN_DAILY_BUDGET)}원~${formatKRW(MAX_DAILY_BUDGET)}원 사이의 정수로 입력해주세요.`
      : null;

  function handleBudgetInputChange(raw: string) {
    setBudgetInput(raw.replace(/[^0-9]/g, ""));
    setSaveState("idle");
  }

  async function saveBudget() {
    if (budgetError) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      await updateBudget(campaign!.id, parsedBudget);
      setSaveState("saved");
      setBudgetInput(null); // 성공 후에만 초안을 비운다 — 그래야 입력창이 항상 확인된 값만 보여준다.
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "저장하지 못했어요. 다시 시도해주세요.");
      // budgetInput은 그대로 둔다 — 실패해도 사용자가 입력한 값을 잃지 않도록.
    }
  }

  async function handleDelete() {
    if (!window.confirm(`"${campaign!.name}" 캠페인을 삭제할까요? 되돌릴 수 없어요.`)) return;
    await deleteCampaign(campaign!.id);
    router.push("/campaigns");
  }

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/campaigns"
          css={css`
            font-size: 13px;
            color: var(--color-gray-500);
            &:hover {
              color: var(--color-gray-700);
            }
          `}
        >
          ← 캠페인
        </Link>
        <div css={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
          <h1 css={{ fontSize: 20, fontWeight: 700, color: "var(--color-gray-900)" }}>{campaign.name}</h1>
          <Badge tone={campaign.status === "active" && !campaign.setupStatus ? "green" : "gray"}>
            {campaignStateLabel(campaign)}
          </Badge>
        </div>
        <div css={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Badge tone="gray">{INDUSTRY_LABEL[campaign.industry]}</Badge>
          <Badge tone="blue">{OBJECTIVE_LABEL[campaign.objective]}</Badge>
          {campaign.metricSource !== "live" && (
            <Badge tone="gray">{campaign.metricSource === "demo" ? "예시 실적" : "실적 연결 전"}</Badge>
          )}
        </div>
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
        <SummaryCard label="총 지출" value={formatCompactKRW(totals.spend)} unit="원" />
        <SummaryCard label="ROAS" value={formatPercent(totals.roas, 0)} />
        <SummaryCard label="CTR" value={formatPercent(totals.ctr, 2)} />
        <SummaryCard label="CPA" value={formatCompactKRW(totals.cpa)} unit="원" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>일별 지출 추이 (최근 14일)</CardTitle>
        </CardHeader>
        {campaign.history.length > 0 ? (
          <LineChart
            data={campaign.history.map((d) => d.spend)}
            labels={campaign.history.map((d) => d.label)}
            height={90}
            showAxis
          />
        ) : (
          <p css={{ padding: "1rem 0", textAlign: "center", fontSize: 13, color: "var(--color-gray-500)" }}>
            아직 집계된 데이터가 없어요. 캠페인이 시작되면 하루 뒤부터 확인할 수 있어요.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>운영 설정</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span css={{ fontSize: 13, color: "var(--color-gray-600)" }}>캠페인 활성화</span>
            {campaign.setupStatus ? (
              <span css={{ fontSize: 12.5, color: "var(--color-gray-500)" }}>
                {campaign.setupStatus === "draft" ? "초안이라 아직 시작할 수 없어요" : "광고 시작 기능은 아직 준비 중이에요"}
              </span>
            ) : (
              <Toggle
                checked={campaign.status === "active"}
                onChange={(checked) => setStatus(campaign.id, checked ? "active" : "paused")}
                label="캠페인 활성 상태"
              />
            )}
          </div>
          {campaign.setupStatus ? (
            <div>
              <span css={{ marginBottom: "0.375rem", display: "block", fontSize: 13, color: "var(--color-gray-600)" }}>
                예산 · 기간
              </span>
              <p css={{ fontSize: 14, fontWeight: 600, color: "var(--color-gray-900)" }}>
                {campaign.totalBudget != null ? `총 ${formatKRW(campaign.totalBudget)}원` : `하루 ${formatKRW(campaign.dailyBudget)}원`}
              </p>
              {campaign.startDate && (
                <p css={{ marginTop: "0.125rem", fontSize: 12.5, color: "var(--color-gray-500)" }}>
                  {campaign.startDate} ~ {campaign.endDate ?? "종료일 없음"}
                </p>
              )}
              <p css={{ marginTop: "0.375rem", fontSize: 12.5, color: "var(--color-gray-500)" }}>
                예산·기간 변경은 아직 여기서 지원하지 않아요.
              </p>
            </div>
          ) : (
            <div>
              <span css={{ marginBottom: "0.375rem", display: "block", fontSize: 13, color: "var(--color-gray-600)" }}>
                일 예산
              </span>
              <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  css={css`
                    display: flex;
                    flex: 1;
                    align-items: center;
                    border-radius: var(--radius-sm);
                    border: 1px solid ${budgetInput !== null && budgetError ? "var(--color-red-500)" : "var(--border-subtle)"};
                    background: var(--color-gray-50);
                    padding: 0.625rem 0.875rem;
                  `}
                >
                  <input
                    value={editingValue}
                    onChange={(e) => handleBudgetInputChange(e.target.value)}
                    inputMode="numeric"
                    aria-invalid={budgetInput !== null && !!budgetError}
                    css={css`
                      width: 100%;
                      background: transparent;
                      font-size: 14px;
                      font-weight: 600;
                      color: var(--color-gray-900);
                      outline: none;
                    `}
                  />
                  <span css={{ fontSize: 13, color: "var(--color-gray-500)" }}>원</span>
                </div>
                <Button size="md" variant="secondary" onClick={saveBudget} disabled={saveState === "saving" || !!budgetError}>
                  {saveState === "saving" ? "저장 중…" : "저장"}
                </Button>
              </div>

              {budgetInput !== null && budgetError && (
                <p css={{ marginTop: "0.375rem", fontSize: 12.5, color: "var(--color-red-500)" }}>{budgetError}</p>
              )}
              {saveState === "saved" && (
                <p
                  css={{
                    marginTop: "0.375rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "var(--color-green-600)",
                  }}
                >
                  <HiCheck style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" /> 저장했어요
                </p>
              )}
              {saveState === "error" && (
                <div css={{ marginTop: "0.375rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <p
                    css={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--color-red-600)",
                    }}
                  >
                    <HiExclamationTriangle style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
                    {saveError}
                  </p>
                  <button
                    type="button"
                    onClick={saveBudget}
                    css={css`
                      font-size: 12.5px;
                      font-weight: 600;
                      color: var(--color-blue-600);
                      &:hover {
                        color: var(--color-blue-700);
                      }
                    `}
                  >
                    다시 시도
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => openAssistantDock(campaign.id)}
                css={css`
                  margin-top: 0.625rem;
                  display: inline-flex;
                  align-items: center;
                  gap: 0.25rem;
                  font-size: 12.5px;
                  font-weight: 600;
                  color: var(--color-blue-600);
                  &:hover {
                    color: var(--color-blue-700);
                  }
                `}
              >
                <HiSparkles style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
                AI에게 예산 변경 요청하기
              </button>
            </div>
          )}
        </div>
      </Card>

      <BudgetAdjustmentHistory campaignId={campaign.id} />

      <Card>
        <CardHeader>
          <CardTitle>업종</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {INDUSTRY_KEYS.map((key) => {
            const active = campaign.industry === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => updateIndustry(campaign.id, key)}
                css={css`
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
                `}
              >
                {INDUSTRY_LABEL[key]}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>타겟팅</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <Badge tone="blue">연령 {campaign.targeting.ageRange}</Badge>
          <Badge tone="blue">
            성별 {campaign.targeting.gender === "all" ? "전체" : campaign.targeting.gender === "male" ? "남성" : "여성"}
          </Badge>
          {campaign.targeting.regions.map((r) => (
            <Badge key={r} tone="gray">
              {r}
            </Badge>
          ))}
          {campaign.targeting.interests.map((i) => (
            <Badge key={i} tone="gray">
              #{i}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>위험 구역</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>캠페인을 삭제하면 되돌릴 수 없어요.</p>
          <Button size="md" variant="danger" onClick={handleDelete}>
            캠페인 삭제
          </Button>
        </div>
      </Card>
    </div>
  );
}
