/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import {
  HiOutlineShoppingCart,
  HiOutlineDevicePhoneMobile,
  HiOutlineChatBubbleLeftRight,
  HiOutlineArrowTrendingUp,
  HiOutlineTrash,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { OBJECTIVE_LABEL, sumHistory } from "@/lib/mock/campaigns";
import { setStatus, deleteCampaign } from "@/lib/mock/store";
import { formatCompactKRW, formatPercent } from "@/lib/format";
import type { Campaign, DisplayObjective } from "@/lib/mock/types";

const OBJECTIVE_ICON: Record<DisplayObjective, IconType> = {
  purchase: HiOutlineShoppingCart,
  app_install: HiOutlineDevicePhoneMobile,
  leads: HiOutlineChatBubbleLeftRight,
  visit: HiOutlineArrowTrendingUp,
};

export function CampaignListItem({ campaign }: { campaign: Campaign }) {
  const totals = sumHistory(campaign.history);
  const ObjectiveIcon = OBJECTIVE_ICON[campaign.objective];

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border-radius: var(--radius-md);
        background: white;
        padding: 1rem;
        box-shadow: var(--shadow-card);
      `}
    >
      <div
        css={css`
          display: flex;
          height: 2.75rem;
          width: 2.75rem;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          background-color: var(--color-gray-100);
          color: var(--color-gray-600);
        `}
      >
        <ObjectiveIcon style={{ height: "1.25rem", width: "1.25rem" }} aria-hidden="true" />
      </div>
      <div css={{ minWidth: 0, flex: 1 }}>
        <Link
          href={`/campaigns/${campaign.id}`}
          css={css`
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 14px;
            font-weight: 600;
            color: var(--color-gray-900);

            &:hover {
              color: var(--color-blue-600);
            }
          `}
        >
          {campaign.name}
        </Link>
        <div css={{ marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Badge tone="gray">{OBJECTIVE_LABEL[campaign.objective]}</Badge>
          {campaign.metricSource !== "live" && (
            <Badge tone="gray">{campaign.metricSource === "demo" ? "데모 데이터" : "실적 연동 전"}</Badge>
          )}
          <span css={{ fontSize: 12, color: "var(--color-gray-500)" }}>
            ROAS {formatPercent(totals.roas, 0)} · 일 {formatCompactKRW(campaign.dailyBudget)}원
          </span>
        </div>
      </div>
      <Toggle
        checked={campaign.status === "active"}
        onChange={(checked) => setStatus(campaign.id, checked ? "active" : "paused")}
        label={`${campaign.name} 활성 상태`}
      />
      <button
        type="button"
        aria-label={`${campaign.name} 삭제`}
        onClick={() => {
          if (window.confirm(`"${campaign.name}" 캠페인을 삭제할까요? 되돌릴 수 없어요.`)) {
            deleteCampaign(campaign.id);
          }
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
  );
}
