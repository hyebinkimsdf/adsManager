/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import {
  useRewardCampaigns,
  setRewardCampaignStatus,
  deleteRewardCampaign,
} from "@/lib/reward/useRewardCampaigns";
import { PRODUCT_LABEL, computeMoneyNotificationCpp } from "@/lib/reward/rules";
import { formatCompactKRW, formatDateTime, formatKRW } from "@/lib/format";
import type { RewardCampaign } from "@/lib/mock/types";

const PRODUCT_TONE: Record<RewardCampaign["productType"], "blue" | "green" | "gray"> = {
  money_notification: "blue",
  lucky_quiz: "green",
  button_press: "gray",
};

function summarize(c: RewardCampaign): string {
  if (c.productType === "money_notification") {
    const cpp = computeMoneyNotificationCpp(c.advancedTargeting);
    return `${c.variant === "basic" ? "일반형" : "라이브형"} · 타겟 ${formatKRW(c.targetSize)}명 · CPP ${cpp}원 · 일 ${formatCompactKRW(
      c.dailyBudget
    )}원`;
  }
  if (c.productType === "lucky_quiz") {
    return `전체 예산 ${formatCompactKRW(c.totalBudget)}원 · 논타겟(혜택탭 전체 유저)`;
  }
  return `${c.creativeType === "button" ? "버튼강조형" : "카탈로그형"} · 일 ${formatCompactKRW(c.dailyBudget)}원 · ${c.landingUrl}`;
}

export default function RewardCampaignsPage() {
  const campaigns = useRewardCampaigns();

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1 css={{ fontSize: 18, fontWeight: 700, color: "var(--color-gray-900)" }}>리워드 광고</h1>
          <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-500)" }}>
            토스 앱의 리워드 지면을 기반으로 하는 상품이에요. 참여 방식과 리워드 제공 여부는 상품마다 달라요.
          </p>
        </div>
        <Link href="/campaigns/reward/new">
          <Button>
            <HiOutlinePlus style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 새 리워드 캠페인
          </Button>
        </Link>
      </div>

      <Card>
        <div css={{ display: "flex", flexDirection: "column" }}>
          {campaigns.map((c, i) => (
            <div
              key={c.id}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.875rem 0;
                ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
              `}
            >
              <Badge tone={PRODUCT_TONE[c.productType]}>{PRODUCT_LABEL[c.productType]}</Badge>
              <div css={{ minWidth: 0, flex: 1 }}>
                <p css={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-gray-900)" }}>{c.name}</p>
                <p css={{ marginTop: "0.125rem", fontSize: 12, color: "var(--color-gray-500)" }}>{summarize(c)}</p>
                <p css={{ marginTop: "0.125rem", fontSize: 11.5, color: "var(--color-gray-400)" }}>
                  {formatDateTime(c.createdAt)} 생성
                </p>
              </div>
              <Toggle
                checked={c.status === "active"}
                onChange={(checked) => setRewardCampaignStatus(c.id, checked ? "active" : "paused")}
                label={`${c.name} 활성 상태`}
              />
              <button
                type="button"
                aria-label={`${c.name} 삭제`}
                onClick={() => {
                  if (window.confirm(`"${c.name}" 캠페인을 삭제할까요? 되돌릴 수 없어요.`)) deleteRewardCampaign(c.id);
                }}
                css={css`
                  display: flex;
                  height: 2rem;
                  width: 2rem;
                  flex-shrink: 0;
                  align-items: center;
                  justify-content: center;
                  border-radius: 9999px;
                  color: var(--color-gray-400);
                  &:hover {
                    background-color: var(--color-red-50);
                    color: var(--color-red-500);
                  }
                `}
              >
                <HiOutlineTrash style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
              </button>
            </div>
          ))}
          {campaigns.length === 0 && (
            <p css={{ padding: "1.5rem 0", textAlign: "center", fontSize: 13, color: "var(--color-gray-500)" }}>
              아직 리워드 캠페인이 없어요.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
