/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  HiOutlineShoppingCart,
  HiOutlineDevicePhoneMobile,
  HiOutlineChatBubbleLeftRight,
  HiOutlineArrowTrendingUp,
  HiOutlineMegaphone,
  HiOutlineTrash,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { OBJECTIVE_LABEL, sumHistory } from "@/lib/mock/campaigns";
import { setStatus, deleteCampaign } from "@/lib/mock/store";
import { formatCompactKRW, formatPercent } from "@/lib/format";
import type { Campaign, DisplayObjective } from "@/lib/mock/types";
import { campaignStateLabel } from "@/lib/campaigns/list";

const OBJECTIVE_ICON: Record<DisplayObjective, IconType> = {
  purchase: HiOutlineShoppingCart,
  app_install: HiOutlineDevicePhoneMobile,
  leads: HiOutlineChatBubbleLeftRight,
  visit: HiOutlineArrowTrendingUp,
  reach: HiOutlineMegaphone,
};

export function CampaignListItem({ campaign }: { campaign: Campaign }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const totals = sumHistory(campaign.history);
  const ObjectiveIcon = OBJECTIVE_ICON[campaign.objective];

  async function change(action: () => Promise<unknown>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "저장하지 못했어요. 다시 시도해 주세요."); }
    finally { pendingRef.current = false; setPending(false); }
  }

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
        <div css={{ marginTop: "0.25rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
          <Badge tone={campaign.status === "active" && !campaign.setupStatus ? "green" : "gray"}>{campaignStateLabel(campaign)}</Badge>
          <Badge tone="gray">{OBJECTIVE_LABEL[campaign.objective]}</Badge>
          {campaign.metricSource !== "live" && (
            <Badge tone="gray">{campaign.metricSource === "demo" ? "예시 실적" : "실적 연결 전"}</Badge>
          )}
          <span css={{ fontSize: 12, color: "var(--color-gray-500)" }}>
            {campaign.totalBudget != null ? `총 ${formatCompactKRW(campaign.totalBudget)}원` : `하루 ${formatCompactKRW(campaign.dailyBudget)}원`}
            {campaign.history.length > 0 && ` · 광고비 대비 매출 ${formatPercent(totals.roas, 0)}`}
          </span>
        </div>
        {campaign.startDate && <p css={{ marginTop: 6, fontSize: 12, color: "var(--color-gray-500)" }}>{campaign.startDate} ~ {campaign.endDate ?? "종료일 없음"}</p>}
        {error && <p role="alert" css={{ marginTop: 6, fontSize: 12, color: "var(--color-red-500)" }}>{error}</p>}
      </div>
      {!campaign.setupStatus && <Toggle
        checked={campaign.status === "active"}
        disabled={pending}
        onChange={(checked) => void change(() => setStatus(campaign.id, checked ? "active" : "paused"))}
        label={`${campaign.name} 활성 상태`}
      />}
      <button
        type="button"
        aria-label={`${campaign.name} 삭제`}
        disabled={pending}
        onClick={() => {
          if (window.confirm(`"${campaign.name}" 캠페인을 삭제할까요? 되돌릴 수 없어요.`)) {
            void change(() => deleteCampaign(campaign.id));
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
