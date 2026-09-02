"use client";

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
import { cn } from "@/lib/cn";
import type { CampaignIndustry } from "@/lib/mock/types";

const INDUSTRY_KEYS = Object.keys(INDUSTRY_LABEL) as CampaignIndustry[];

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaign = useCampaign(params.id);
  const [budgetInput, setBudgetInput] = useState<string | null>(null);

  if (!campaign) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-white p-10 text-center shadow-[var(--shadow-card)]">
        <p className="text-[14px] text-[var(--color-gray-600)]">캠페인을 찾을 수 없어요.</p>
        <Link href="/campaigns" className="mt-3 inline-block text-[13px] font-medium text-[var(--color-blue-600)]">
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

  function handleDelete() {
    if (!window.confirm(`"${campaign!.name}" 캠페인을 삭제할까요? 되돌릴 수 없어요.`)) return;
    deleteCampaign(campaign!.id);
    router.push("/campaigns");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/campaigns" className="text-[13px] text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]">
          ← 캠페인
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-[20px] font-bold text-[var(--color-gray-900)]">{campaign.name}</h1>
          <Badge tone={campaign.status === "active" ? "green" : "gray"}>
            {campaign.status === "active" ? "진행 중" : "일시정지"}
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone="gray">{INDUSTRY_LABEL[campaign.industry]}</Badge>
          {campaign.channels.map((ch) => (
            <Badge key={ch} tone="gray">
              {CHANNEL_LABEL[ch]}
            </Badge>
          ))}
          <Badge tone="blue">{OBJECTIVE_LABEL[campaign.objective]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <p className="py-4 text-center text-[13px] text-[var(--color-gray-500)]">
            아직 집계된 데이터가 없어요. 캠페인이 시작되면 하루 뒤부터 확인할 수 있어요.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>운영 설정</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--color-gray-600)]">캠페인 활성화</span>
            <Toggle
              checked={campaign.status === "active"}
              onChange={(checked) => setStatus(campaign.id, checked ? "active" : "paused")}
              label="캠페인 활성 상태"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] text-[var(--color-gray-600)]">일 예산</span>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--color-gray-50)] px-3.5 py-2.5">
                <input
                  value={editingValue}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  inputMode="numeric"
                  className="w-full bg-transparent text-[14px] font-semibold text-[var(--color-gray-900)] outline-none"
                />
                <span className="text-[13px] text-[var(--color-gray-500)]">원</span>
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
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_KEYS.map((key) => {
            const active = campaign.industry === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => updateIndustry(campaign.id, key)}
                className={cn(
                  "rounded-[var(--radius-full)] border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-[var(--color-blue-500)] bg-[var(--color-blue-50)] text-[var(--color-blue-600)]"
                    : "border-[var(--border-subtle)] bg-white text-[var(--color-gray-700)] hover:border-[var(--color-blue-500)]"
                )}
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
        <div className="flex flex-wrap gap-2">
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
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>위험 구역</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-[var(--color-gray-500)]">
            캠페인을 삭제하면 되돌릴 수 없어요.
          </p>
          <Button size="md" variant="danger" onClick={handleDelete}>
            캠페인 삭제
          </Button>
        </div>
      </Card>
    </div>
  );
}
