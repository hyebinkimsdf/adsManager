import type {
  AdType,
  Campaign,
  CampaignIndustry,
  CampaignStatus,
  DayMetric,
  DisplayObjective,
  Targeting,
} from "@/lib/mock/types";

// D1(SQLite)에는 배열/JSON 타입이 없어 targeting/history를 TEXT 컬럼에 JSON 문자열로 저장한다.
export interface CampaignRow {
  id: string;
  name: string;
  adType: string;
  objective: string;
  industry: string;
  status: string;
  dailyBudget: number;
  targeting: string;
  history: string;
}

export function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    adType: row.adType as AdType,
    objective: row.objective as DisplayObjective,
    industry: row.industry as CampaignIndustry,
    status: row.status as CampaignStatus,
    dailyBudget: row.dailyBudget,
    targeting: JSON.parse(row.targeting) as Targeting,
    history: JSON.parse(row.history) as DayMetric[],
  };
}

export function toCampaignRow(campaign: Campaign): CampaignRow {
  return {
    id: campaign.id,
    name: campaign.name,
    adType: campaign.adType,
    objective: campaign.objective,
    industry: campaign.industry,
    status: campaign.status,
    dailyBudget: campaign.dailyBudget,
    targeting: JSON.stringify(campaign.targeting),
    history: JSON.stringify(campaign.history),
  };
}
