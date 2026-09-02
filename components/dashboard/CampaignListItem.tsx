"use client";

import Link from "next/link";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineChatBubbleLeftRight,
  HiOutlinePhoto,
  HiOutlineFilm,
  HiOutlineTrash,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { CHANNEL_LABEL, sumHistory } from "@/lib/mock/campaigns";
import { setStatus, deleteCampaign } from "@/lib/mock/store";
import { formatCompactKRW, formatPercent } from "@/lib/format";
import type { Campaign, CampaignChannel } from "@/lib/mock/types";

const CHANNEL_ICON: Record<CampaignChannel, IconType> = {
  search: HiOutlineMagnifyingGlass,
  social: HiOutlineChatBubbleLeftRight,
  display: HiOutlinePhoto,
  video: HiOutlineFilm,
};

export function CampaignListItem({ campaign }: { campaign: Campaign }) {
  const totals = sumHistory(campaign.history);
  const ChannelIcon = CHANNEL_ICON[campaign.channels[0]];

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-gray-100)] text-[var(--color-gray-600)]">
        <ChannelIcon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/campaigns/${campaign.id}`} className="block truncate text-[14px] font-semibold text-[var(--color-gray-900)] hover:text-[var(--color-blue-600)]">
          {campaign.name}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          {campaign.channels.map((ch) => (
            <Badge key={ch} tone="gray">
              {CHANNEL_LABEL[ch]}
            </Badge>
          ))}
          <span className="text-[12px] text-[var(--color-gray-500)]">
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-gray-400)] hover:bg-[var(--color-red-50)] hover:text-[var(--color-red-500)]"
      >
        <HiOutlineTrash className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
