export interface PositionBidDto {
  position: number;
  bid: number;
}

export interface KeywordBidEstimateDto {
  keyword: string;
  medianBid: number;
  minBid: number;
  estimatedDailyClicks: number;
  estimatedDailyCost: number;
  positionBids: PositionBidDto[];
}

export async function fetchKeywordBidEstimates(keywords: string[]): Promise<KeywordBidEstimateDto[] | null> {
  if (keywords.length === 0) return null;

  try {
    const res = await fetch("/api/keywords/naver/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { estimates?: KeywordBidEstimateDto[] };
    if (!data.estimates || data.estimates.length === 0) return null;
    return data.estimates;
  } catch {
    return null;
  }
}

export interface PositionEstimateDto {
  bid: number;
  estimatedDailyClicks: number;
  estimatedDailyCost: number;
}

export async function fetchPositionEstimate(keyword: string, position: number): Promise<PositionEstimateDto | null> {
  try {
    const res = await fetch("/api/keywords/naver/position-bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, position }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PositionEstimateDto>;
    if (typeof data.bid !== "number") return null;
    return {
      bid: data.bid,
      estimatedDailyClicks: data.estimatedDailyClicks ?? 0,
      estimatedDailyCost: data.estimatedDailyCost ?? 0,
    };
  } catch {
    return null;
  }
}
