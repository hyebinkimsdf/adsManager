/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
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
    <Card
      css={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
        @media (min-width: 640px) {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
      `}
    >
      <div css={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <span
          css={css`
            display: flex;
            height: 3rem;
            width: 3rem;
            flex-shrink: 0;
            align-items: center;
            justify-content: center;
            border-radius: 9999px;
            background-color: var(--color-blue-50);
          `}
        >
          <HiSparkles style={{ height: "1.5rem", width: "1.5rem", color: "var(--color-blue-500)" }} aria-hidden="true" />
        </span>
        <div>
          <p css={{ fontSize: 12, fontWeight: 600, color: "var(--color-blue-600)" }}>✦ AI 추천</p>
          <p css={{ marginTop: "0.125rem", fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
            광고 성과를 더 높일 수 있어요!
          </p>
          <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-500)" }}>
            AI가 캠페인을 분석했어요. 아래 버튼을 눌러 개선해보세요.
          </p>
          <div css={{ marginTop: "0.625rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {TAGS.map((t) => (
              <span
                key={t.label}
                css={css`
                  display: inline-flex;
                  align-items: center;
                  gap: 0.25rem;
                  border-radius: 9999px;
                  background-color: var(--color-gray-100);
                  padding: 0.25rem 0.625rem;
                  font-size: 12px;
                  font-weight: 500;
                  color: var(--color-gray-600);
                `}
              >
                <t.icon style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Button
        size="lg"
        css={css`
          width: 100%;
          flex-shrink: 0;
          @media (min-width: 640px) {
            width: auto;
          }
        `}
        disabled={applied}
        onClick={handleImprove}
      >
        {applied ? (
          <span css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <HiCheck style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 적용 완료
          </span>
        ) : (
          <span css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <HiSparkles style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> AI가 개선하기
            <HiArrowRight style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
          </span>
        )}
      </Button>
    </Card>
  );
}
