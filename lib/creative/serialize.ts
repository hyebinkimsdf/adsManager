import type { Creative } from "@/lib/mock/types";

export interface CreativeRow {
  id: string;
  campaignId: string;
  campaignName: string;
  headline: string;
  body: string;
  imageWidth: number | null;
  imageHeight: number | null;
  landingUrl: string;
  precheckScore: number;
  precheckItems: string;
  createdAt: string;
}

export function toCreative(row: CreativeRow): Creative {
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    headline: row.headline,
    body: row.body,
    imageWidth: row.imageWidth ?? undefined,
    imageHeight: row.imageHeight ?? undefined,
    landingUrl: row.landingUrl,
    precheckScore: row.precheckScore,
    precheckItems: JSON.parse(row.precheckItems) as Creative["precheckItems"],
    createdAt: row.createdAt,
  };
}

export function toCreativeRow(creative: Creative): CreativeRow {
  return {
    id: creative.id,
    campaignId: creative.campaignId,
    campaignName: creative.campaignName,
    headline: creative.headline,
    body: creative.body,
    imageWidth: creative.imageWidth ?? null,
    imageHeight: creative.imageHeight ?? null,
    landingUrl: creative.landingUrl,
    precheckScore: creative.precheckScore,
    precheckItems: JSON.stringify(creative.precheckItems),
    createdAt: creative.createdAt,
  };
}
