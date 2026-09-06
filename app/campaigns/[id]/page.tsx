/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCampaign } from "@/lib/mock/store";
import { updateBudget, setStatus, updateTargeting, updateIndustry, deleteCampaign } from "@/lib/mock/store";
import { sumHistory, CHANNEL_LABEL, OBJECTIVE_LABEL, INDUSTRY_LABEL } from "@/lib/mock/campaigns";
import { formatCompactKRW, formatPercent } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { LineChart } from "@/components/dashboard/LineChart";
import { KeywordAssistant } from "@/components/campaigns/KeywordAssistant";
import type { CampaignIndustry } from "@/lib/mock/types";

const INDUSTRY_KEYS = Object.keys(INDUSTRY_LABEL) as CampaignIndustry[];

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaign = useCampaign(params.id);
  const [budgetInput, setBudgetInput] = useState<string | null>(null);

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

  function saveBudget() {
    const value = Number(editingValue.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(value)) return;
    updateBudget(campaign!.id, value);
    setBudgetInput(null);
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
          <Badge tone={campaign.status === "active" ? "green" : "gray"}>
            {campaign.status === "active" ? "진행 중" : "일시정지"}
          </Badge>
        </div>
        <div css={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Badge tone="gray">{INDUSTRY_LABEL[campaign.industry]}</Badge>
          {campaign.channels.map((ch) => (
            <Badge key={ch} tone="gray">
              {CHANNEL_LABEL[ch]}
            </Badge>
          ))}
          <Badge tone="blue">{OBJECTIVE_LABEL[campaign.objective]}</Badge>
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
            <Toggle
              checked={campaign.status === "active"}
              onChange={(checked) => setStatus(campaign.id, checked ? "active" : "paused")}
              label="캠페인 활성 상태"
            />
          </div>
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
                  border: 1px solid var(--border-subtle);
                  background: var(--color-gray-50);
                  padding: 0.625rem 0.875rem;
                `}
              >
                <input
                  value={editingValue}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  inputMode="numeric"
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
              <Button size="md" variant="secondary" onClick={saveBudget}>
                저장
              </Button>
            </div>
          </div>
        </div>
      </Card>

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
          <CardTitle>키워드</CardTitle>
        </CardHeader>
        <KeywordAssistant
          objective={campaign.objective}
          channels={campaign.channels}
          industry={campaign.industry}
          name={campaign.name}
          selected={campaign.targeting.keywords}
          onChange={(keywords) => updateTargeting(campaign.id, { keywords })}
          dailyBudget={campaign.dailyBudget}
        />
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
