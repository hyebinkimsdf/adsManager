import type { Campaign, CampaignIndustry, DisplayObjective, Targeting } from "@/lib/mock/types";
import { sumHistory } from "@/lib/mock/campaigns";
import { metricHistory } from "@/lib/campaignMetrics";
import { MAX_DAILY_BUDGET, MIN_DAILY_BUDGET } from "./validate";

function comparisonHistory(campaign: Campaign) {
  if (campaign.metricSource === "live") return metricHistory(campaign, 14);
  if (campaign.metricSource !== "demo") return [];
  return campaign.history.filter((day) =>
    [day.spend, day.impressions, day.clicks, day.conversions, day.revenue].every((value) => Number.isFinite(value) && value >= 0)
  );
}

function ageBounds(value: string): [number, number] | null {
  if (["전체", "all"].includes(value.trim().toLowerCase())) return [0, Infinity];
  const match = /^(\d+)\s*[-~]\s*(\d+)$/.exec(value.trim());
  if (!match || Number(match[1]) > Number(match[2])) return null;
  return [Number(match[1]), Number(match[2])];
}

function overlaps(a: string[], b: string[], unrestricted: string[]): boolean {
  const left = a.map((value) => value.trim().toLowerCase());
  const right = b.map((value) => value.trim().toLowerCase());
  if (!left.length || !right.length || [...left, ...right].some((value) => unrestricted.includes(value))) return true;
  return left.some((value) => right.includes(value));
}

function compatibleTargeting(a: Targeting, b: Targeting): boolean {
  const leftAge = ageBounds(a.ageRange);
  const rightAge = ageBounds(b.ageRange);
  return leftAge !== null && rightAge !== null &&
    Math.max(leftAge[0], rightAge[0]) <= Math.min(leftAge[1], rightAge[1]) &&
    (a.gender === "all" || b.gender === "all" || a.gender === b.gender) &&
    overlaps(a.regions, b.regions, ["전국", "전체", "all"]) &&
    overlaps(a.interests, b.interests, ["전체", "all"]);
}

/**
 * 목표와 타겟 조건이 겹치는 후보 중 업종 일치를 우선한다. 실제 실적은 최근 14일의 검증된
 * 기록만, 데모는 데모끼리만 비교한다. 지출·매출이 있고 ROAS가 100% 이상인 조건은 최소
 * 참고 기준일 뿐 수익성이나 예산 증액 효과를 보장하지 않는다.
 */
export function findComparableCampaigns(campaign: Campaign, all: Campaign[], limit = 5): Campaign[] {
  if (campaign.metricSource !== "live" && campaign.metricSource !== "demo") return [];
  return all
    .filter((c) => c.id !== campaign.id && c.objective === campaign.objective &&
      c.metricSource === campaign.metricSource && compatibleTargeting(campaign.targeting, c.targeting) &&
      Number.isSafeInteger(c.dailyBudget) && c.dailyBudget >= MIN_DAILY_BUDGET && c.dailyBudget <= MAX_DAILY_BUDGET)
    .map((c) => ({ c, industryMatch: c.industry === campaign.industry ? 1 : 0, totals: sumHistory(comparisonHistory(c)) }))
    .filter(({ totals }) => totals.spend > 0 && totals.revenue > 0 && Number.isFinite(totals.roas) && totals.roas >= 100)
    .sort((a, b) => b.industryMatch - a.industryMatch || b.totals.roas - a.totals.roas || a.c.id.localeCompare(b.c.id))
    .slice(0, Math.max(0, limit))
    .map(({ c }) => c);
}

export interface BudgetRecommendationFacts {
  campaignId: string;
  objective: DisplayObjective;
  industry: CampaignIndustry;
  currentBudget: number;
  range: { min: number; max: number };
  baselineBudget: number;
  ownRoas: number | null;
  comparableCount: number;
  comparableAvgRoas: number | null;
  comparableAvgBudget: number | null;
  comparableMedianBudget: number | null;
  recommendedBudget: number;
  direction: "up" | "down" | "flat";
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 선택 범위 안에서 현재 예산에 가장 가까운 값을 기준으로 삼는다. 비교 예산 중앙값으로
 * 절반만 이동하되 기준값의 ±20% 이내로 제한한다. 큰 구간 상한이나 ROAS 차이로 금액을
 * 결정하지 않는다. 이 규칙은 보수적인 참고값 계산이며 최적 예산을 추정하는 모델은 아니다.
 */
export function decideBudgetRecommendation(
  campaign: Campaign,
  comparables: Campaign[],
  range: { min: number; max: number }
): BudgetRecommendationFacts {
  const ownTotals = sumHistory(comparisonHistory(campaign));
  const ownRoas = ownTotals.spend > 0 ? ownTotals.roas : null;
  const qualified = findComparableCampaigns(campaign, comparables);
  const comparableAvgRoas = qualified.length ? average(qualified.map((c) => sumHistory(comparisonHistory(c)).roas)) : null;
  const comparableAvgBudget = qualified.length ? average(qualified.map((c) => c.dailyBudget)) : null;
  const comparableMedianBudget = qualified.length ? median(qualified.map((c) => c.dailyBudget)) : null;
  const baselineBudget = clamp(campaign.dailyBudget, range.min, range.max);
  const lower = Math.max(range.min, Math.ceil(baselineBudget * 0.8));
  const upper = Math.min(range.max, Math.floor(baselineBudget * 1.2));
  const target = comparableMedianBudget === null ? baselineBudget : baselineBudget + (comparableMedianBudget - baselineBudget) / 2;
  const recommendedBudget = clamp(Math.round(target), lower, upper);
  const direction = recommendedBudget > campaign.dailyBudget ? "up" : recommendedBudget < campaign.dailyBudget ? "down" : "flat";

  return {
    campaignId: campaign.id,
    objective: campaign.objective,
    industry: campaign.industry,
    currentBudget: campaign.dailyBudget,
    range,
    baselineBudget,
    ownRoas,
    comparableCount: qualified.length,
    comparableAvgRoas,
    comparableAvgBudget,
    comparableMedianBudget,
    recommendedBudget,
    direction,
  };
}

/** 온디바이스 AI를 못 쓸 때도 성과 관계를 증감 방향으로 추측하지 않는다. */
export function templateBudgetReasoning(facts: BudgetRecommendationFacts): string {
  const rangeReason = facts.baselineBudget === facts.currentBudget
    ? "현재 일 예산을 기준으로"
    : "선택하신 범위에서 현재 일 예산에 가장 가까운 금액을 기준으로";
  if (facts.comparableCount === 0) {
    return `비교 조건을 충족하는 캠페인이 없어, ${rangeReason} ${facts.recommendedBudget.toLocaleString("ko-KR")}원을 제안해요.`;
  }
  return `${rangeReason}, 비교 조건을 충족하는 ${facts.comparableCount}건의 일 예산 중앙값 ${facts.comparableMedianBudget!.toLocaleString("ko-KR")}원을 참고해 ${facts.recommendedBudget.toLocaleString("ko-KR")}원을 제안해요. 비교 캠페인의 ROAS가 예산 변경 후 성과를 보장하지는 않아요.`;
}
