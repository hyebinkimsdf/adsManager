import type { Campaign } from "@/lib/mock/types";

export type CampaignListFilter = "all" | "active" | "paused" | "draft";

export function campaignStateLabel(campaign: Campaign): string {
  if (campaign.setupStatus === "draft") return "초안";
  if (campaign.setupStatus === "configured") return "설정 저장됨";
  return campaign.status === "active" ? "진행 중" : "멈춤";
}

export function filterCampaigns(campaigns: Campaign[], filter: CampaignListFilter, search: string): Campaign[] {
  const term = search.trim().normalize("NFC").toLocaleLowerCase("ko-KR");
  return campaigns.filter(campaign => {
    const matches = filter === "all" || (filter === "draft"
      ? campaign.setupStatus === "draft"
      : filter === "paused"
        ? campaign.status === "paused" && campaign.setupStatus !== "draft"
        : campaign.status === "active" && !campaign.setupStatus);
    return matches && campaign.name.normalize("NFC").toLocaleLowerCase("ko-KR").includes(term);
  });
}
