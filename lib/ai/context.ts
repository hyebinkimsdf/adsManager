import type { Campaign } from "../mock/types";
import { sumHistory, trendPercent } from "../mock/campaigns";
import type { CampaignSnapshot } from "./types";

export function buildSnapshots(campaigns: Campaign[]): CampaignSnapshot[] {
  return campaigns.map((c) => {
    const totals = sumHistory(c.history);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      channels: c.channels,
      industry: c.industry,
      dailyBudget: c.dailyBudget,
      ctr: totals.ctr,
      cpa: totals.cpa,
      roas: totals.roas,
      spendTrendPercent: trendPercent(c.history, "spend"),
      keywords: c.targeting.keywords,
    };
  });
}

export function snapshotsToPromptJson(snapshots: CampaignSnapshot[]): string {
  return JSON.stringify(
    snapshots.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      channels: s.channels,
      industry: s.industry,
      dailyBudget: s.dailyBudget,
      ctr: Number(s.ctr.toFixed(2)),
      cpa: Math.round(s.cpa),
      roas: Number(s.roas.toFixed(1)),
      spendTrend: Number(s.spendTrendPercent.toFixed(1)),
      keywords: s.keywords,
    }))
  );
}
