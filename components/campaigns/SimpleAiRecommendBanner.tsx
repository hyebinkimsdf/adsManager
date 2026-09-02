"use client";

import { useState } from "react";
import {
  HiArrowRight,
  HiCheck,
  HiOutlineCurrencyDollar,
  HiOutlinePhoto,
  HiOutlineUserGroup,
  HiSparkles,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { adjustBudgetByPercent } from "@/lib/mock/store";
import { sumHistory } from "@/lib/mock/campaigns";
import type { Campaign } from "@/lib/mock/types";

const TAGS: { icon: IconType; label: string }[] = [
  { icon: HiOutlineCurrencyDollar, label: "예산 최적화" },
  { icon: HiOutlineUserGroup, label: "타겟 확장" },
  { icon: HiOutlinePhoto, label: "소재 개선" },
];

export function SimpleAiRecommendBanner({ campaigns }: { campaigns: Campaign[] }) {
  const [applied, setApplied] = useState(false);
  const active = campaigns.filter((c) => c.status === "active");
  if (active.length === 0) return null;

  const handleImprove = () => {
    const worst = [...active].sort(
      (a, b) => sumHistory(a.history).roas - sumHistory(b.history).roas
    )[0];
    adjustBudgetByPercent(worst.id, -15);
    setApplied(true);
  };

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-blue-50)]">
          <HiSparkles className="h-6 w-6 text-[var(--color-blue-500)]" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[12px] font-semibold text-[var(--color-blue-600)]">✦ AI 추천</p>
          <p className="mt-0.5 text-[16px] font-bold text-[var(--color-gray-900)]">
            광고 성과를 더 높일 수 있어요!
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-gray-500)]">
            AI가 캠페인을 분석했어요. 아래 버튼을 눌러 개선해보세요.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <span
                key={t.label}
                className="inline-flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-gray-100)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-gray-600)]"
              >
                <t.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Button size="lg" className="w-full shrink-0 sm:w-auto" disabled={applied} onClick={handleImprove}>
        {applied ? (
          <span className="flex items-center gap-1.5">
            <HiCheck className="h-4 w-4" aria-hidden="true" /> 적용 완료
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <HiSparkles className="h-4 w-4" aria-hidden="true" /> AI가 개선하기
            <HiArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </Button>
    </Card>
  );
}
