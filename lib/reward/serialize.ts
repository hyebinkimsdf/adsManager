import type { RewardCampaign } from "@/lib/mock/types";

export interface RewardCampaignRow {
  id: string;
  name: string;
  productType: string;
  status: string;
  config: string;
  createdAt: string;
}

export function toRewardCampaign(row: RewardCampaignRow): RewardCampaign {
  const config = JSON.parse(row.config) as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    productType: row.productType,
    status: row.status,
    createdAt: row.createdAt,
    ...config,
  } as RewardCampaign;
}

export function toRewardCampaignRow(campaign: RewardCampaign): RewardCampaignRow {
  const { id, name, productType, status, createdAt, ...config } = campaign;
  return {
    id,
    name,
    productType,
    status,
    createdAt,
    config: JSON.stringify(config),
  };
}
