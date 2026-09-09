import type { Campaign, DayMetric } from "./mock/types";
import { sumHistory, trendPercent } from "./mock/campaigns";
import { formatKRW, formatSignedPercent } from "./format";
import type { WeeklyCampaignInput } from "./ai/weeklyAnalysisPrompt";
import type { WeeklyAnalysisRecommendation, WeeklyAnalysisSpotlight } from "./ai/weeklyAnalysisSchema";

export interface Insight {
  id: string;
  tone: "positive" | "negative" | "neutral";
  text: string;
}

export interface RoasBucket {
  key: "good" | "okay" | "bad";
  label: string;
  emoji: string;
  description: string;
  avgRoas: number;
  count: number;
}

export interface RoasBucketSummary {
  buckets: RoasBucket[];
  /** 지출 이력이 아직 없어 3단계 분류에서 제외한 캠페인 수 (신규 캠페인 등) */
  noDataCount: number;
}

const ROAS_GOOD_THRESHOLD = 250;
const ROAS_OKAY_THRESHOLD = 120;

/**
 * 간편 모드 캠페인 요약용 — ROAS 기준으로 캠페인을 좋아요/무난해요/아쉬워요 3단계로 나눈다.
 * 지출 이력이 없는 캠페인은 ROAS가 0으로 계산돼 "아쉬워요"로 잘못 분류되므로 집계에서 제외한다.
 */
export function buildRoasBuckets(campaigns: Campaign[]): RoasBucketSummary {
  const good: Campaign[] = [];
  const okay: Campaign[] = [];
  const bad: Campaign[] = [];
  let noDataCount = 0;

  for (const c of campaigns) {
    const totals = sumHistory(c.history);
    if (totals.spend === 0) {
      noDataCount += 1;
      continue;
    }
    if (totals.roas >= ROAS_GOOD_THRESHOLD) good.push(c);
    else if (totals.roas >= ROAS_OKAY_THRESHOLD) okay.push(c);
    else bad.push(c);
  }

  const avgRoas = (list: Campaign[]) =>
    list.length === 0 ? 0 : list.reduce((sum, c) => sum + sumHistory(c.history).roas, 0) / list.length;

  return {
    buckets: [
      {
        key: "good",
        label: "좋아요!",
        emoji: "😊",
        description: "광고 성과가 매우 좋아요! 🎉",
        avgRoas: avgRoas(good),
        count: good.length,
      },
      {
        key: "okay",
        label: "무난해요",
        emoji: "😐",
        description: "조금만 더 개선하면 좋아질 거예요.",
        avgRoas: avgRoas(okay),
        count: okay.length,
      },
      {
        key: "bad",
        label: "아쉬워요",
        emoji: "😞",
        description: "광고를 개선할 부분이 있어요.",
        avgRoas: avgRoas(bad),
        count: bad.length,
      },
    ],
    noDataCount,
  };
}

export function buildInsights(campaigns: Campaign[]): Insight[] {
  const active = campaigns.filter((c) => c.status === "active");
  if (active.length === 0) return [];

  const insights: Insight[] = [];

  const withTrend = active.map((c) => ({
    campaign: c,
    ctrTrend: trendPercent(c.history, "clicks"),
  }));
  const bestCtr = [...withTrend].sort((a, b) => b.ctrTrend - a.ctrTrend)[0];
  if (bestCtr && bestCtr.ctrTrend > 5) {
    insights.push({
      id: "ctr-up",
      tone: "positive",
      text: `${bestCtr.campaign.name}의 클릭이 최근 ${formatSignedPercent(bestCtr.ctrTrend, 0)} 늘었어요.`,
    });
  }

  const worstRoas = [...active]
    .map((c) => ({ c, totals: sumHistory(c.history) }))
    .sort((a, b) => a.totals.roas - b.totals.roas)[0];
  if (worstRoas && worstRoas.totals.roas < 150) {
    insights.push({
      id: "roas-low",
      tone: "negative",
      text: `${worstRoas.c.name}의 ROAS가 ${worstRoas.totals.roas.toFixed(0)}%로 낮은 편이에요. 예산 조정을 검토해보세요.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "stable",
      tone: "neutral",
      text: "전체 캠페인이 안정적인 흐름을 유지하고 있어요.",
    });
  }

  return insights.slice(0, 2);
}

/**
 * 최근 `days`일간 캠페인 전체를 합산한 일별 시계열. history는 날짜 인덱스가 캠페인 간 동일하게 정렬돼 있어
 * 인덱스 기준으로 그대로 더할 수 있다.
 */
export function dailySeries(campaigns: Campaign[], days: number, key: keyof DayMetric): number[] {
  const series = new Array(days).fill(0) as number[];
  for (const c of campaigns) {
    const slice = c.history.slice(-days);
    slice.forEach((d, i) => {
      series[i] += d[key] as number;
    });
  }
  return series;
}

export interface WeeklyRecommendation {
  id: string;
  tone: "warning" | "positive" | "info";
  title: string;
  detail: string;
  buttonLabel: string;
  impactLabel: string;
  impactValue: string;
  campaignId: string;
  kind: "lower_budget" | "raise_budget" | "focus_target";
  /** 적용 버튼을 눌렀을 때 실제로 쓸 조정 비율. lower_budget은 음수, raise_budget은 양수, focus_target은 0(조정 없음, 타겟 화면으로 이동). */
  percent: number;
}

function withLast7Totals(campaigns: Campaign[]) {
  return campaigns
    .filter((c) => c.status === "active")
    .map((c) => ({ c, totals: sumHistory(c.history.slice(-7)) }))
    .filter((w) => w.totals.spend > 0);
}

function overallConversionRate(withTotals: ReturnType<typeof withLast7Totals>): number {
  const clicks = withTotals.reduce((sum, w) => sum + w.totals.clicks, 0);
  const conversions = withTotals.reduce((sum, w) => sum + w.totals.conversions, 0);
  return clicks > 0 ? (conversions / clicks) * 100 : 0;
}

/** lower_bid 카드의 "예상 절감 금액" — 입찰가를 percent%만큼 낮추면 그 비율만큼 지출이 줄어든다고 근사한다. */
function estimateSavings(spend: number, percent: number): string {
  return `${formatKRW(spend * (Math.abs(percent) / 100))}원`;
}

/** raise_budget 카드의 "예상 추가 문의" — 예산을 15% 늘리면 문의가 8~12% 늘어난다는 원래 비율(체감 수익 감소 가정)을 percent에 맞춰 그대로 스케일한다. */
function estimateExtraConversions(conversions: number, percent: number): string {
  const ratio = percent / 15;
  const low = Math.max(1, Math.round(conversions * 0.08 * ratio));
  const high = Math.max(low + 1, Math.round(conversions * 0.12 * ratio));
  return `+${low}~${high}건`;
}

/** focus_target 카드의 "예상 전환율" — 이 캠페인의 전환율이 전체 평균보다 얼마나 높은지. */
function estimateConversionRateDelta(campaignRate: number, overallRate: number): string {
  const delta = Math.max(0.1, Math.round((campaignRate - overallRate) * 10) / 10);
  return `+${delta.toFixed(1)}%p`;
}

/**
 * 메인 대시보드 "이번 주 추천 액션" 카드용 — 최근 7일 데이터에서 바로 실행 가능한 액션 최대 3개를 뽑는다.
 * AI 분석이 불가능할 때 쓰는 규칙 기반 폴백. (실제 AI 경로는 buildWeeklyCampaignInputs + hydrateWeeklyRecommendation)
 */
export function buildWeeklyRecommendations(campaigns: Campaign[]): WeeklyRecommendation[] {
  const withTotals = withLast7Totals(campaigns);
  const results: WeeklyRecommendation[] = [];

  const worst = [...withTotals].sort((a, b) => a.totals.roas - b.totals.roas)[0];
  if (worst && worst.totals.roas < 150) {
    const percent = -20;
    results.push({
      id: `low-eff-${worst.c.id}`,
      tone: "warning",
      title: `${worst.c.name}의 예산을 줄이는 게 좋아요`,
      detail: `최근 7일간 ${formatKRW(worst.totals.spend)}원이 사용됐지만, 전환이 ${
        worst.totals.conversions === 0 ? "없었어요" : "적었어요"
      }.`,
      buttonLabel: "적용하기",
      impactLabel: "예상 절감 금액",
      impactValue: estimateSavings(worst.totals.spend, percent),
      campaignId: worst.c.id,
      kind: "lower_budget",
      percent,
    });
  }

  const best = [...withTotals]
    .filter((w) => w.c.id !== worst?.c.id)
    .sort((a, b) => b.totals.roas - a.totals.roas)[0];
  if (best && best.totals.roas >= 150) {
    const percent = 15;
    results.push({
      id: `raise-budget-${best.c.id}`,
      tone: "positive",
      title: "성과가 좋은 캠페인의 예산을 늘려보세요",
      detail: `${best.c.name}의 예산을 15% 늘리면, 더 많은 전환을 기대할 수 있어요.`,
      buttonLabel: "적용하기",
      impactLabel: "예상 추가 전환",
      impactValue: estimateExtraConversions(best.totals.conversions, percent),
      campaignId: best.c.id,
      kind: "raise_budget",
      percent,
    });
  }

  const topConversion = [...withTotals].sort((a, b) => b.totals.conversions - a.totals.conversions)[0];
  if (topConversion && topConversion.totals.conversions > 0) {
    const overallRate = overallConversionRate(withTotals);
    const topRate = topConversion.totals.clicks > 0 ? (topConversion.totals.conversions / topConversion.totals.clicks) * 100 : 0;
    results.push({
      id: `target-${topConversion.c.id}`,
      tone: "info",
      title: `${topConversion.c.targeting.ageRange.replace("-", "~")}세 타겟에 더 집중해보세요`,
      detail: "이 연령대에서 문의가 가장 많아요.",
      buttonLabel: "설정하기",
      impactLabel: "예상 전환율",
      impactValue: estimateConversionRateDelta(topRate, overallRate),
      campaignId: topConversion.c.id,
      kind: "focus_target",
      percent: 0,
    });
  }

  return results.slice(0, 3);
}

const TONE_BY_KIND: Record<WeeklyRecommendation["kind"], WeeklyRecommendation["tone"]> = {
  lower_budget: "warning",
  raise_budget: "positive",
  focus_target: "info",
};

const BUTTON_LABEL_BY_KIND: Record<WeeklyRecommendation["kind"], string> = {
  lower_budget: "적용하기",
  raise_budget: "적용하기",
  focus_target: "설정하기",
};

const IMPACT_LABEL_BY_KIND: Record<WeeklyRecommendation["kind"], string> = {
  lower_budget: "예상 절감 금액",
  raise_budget: "예상 추가 전환",
  focus_target: "예상 전환율",
};

/** AI가 골라준 캠페인 요약(id/name/dailyBudget/최근 7일 지표 등)을 만든다. */
export function buildWeeklyCampaignInputs(campaigns: Campaign[]): WeeklyCampaignInput[] {
  return withLast7Totals(campaigns).map(({ c, totals }) => ({
    id: c.id,
    name: c.name,
    dailyBudget: c.dailyBudget,
    last7Spend: totals.spend,
    last7Conversions: totals.conversions,
    last7Clicks: totals.clicks,
    roas: totals.roas,
    conversionsTrendPercent: trendPercent(c.history, "conversions"),
    ageRange: c.targeting.ageRange,
  }));
}

/**
 * AI가 고른 추천(campaignId·kind·title·detail·percent)에 실제 캠페인 데이터를 붙여 화면에 쓸 형태로 만든다.
 * campaignId가 실제 캠페인 목록에 없으면(모델이 지어냈으면) null을 반환해 걸러낸다 — 수치는 항상 코드가 계산한다.
 */
export function hydrateWeeklyRecommendation(
  campaigns: Campaign[],
  rec: WeeklyAnalysisRecommendation
): WeeklyRecommendation | null {
  const withTotals = withLast7Totals(campaigns);
  const match = withTotals.find((w) => w.c.id === rec.campaignId);
  if (!match) return null;
  if (!["lower_budget", "raise_budget", "focus_target"].includes(rec.kind)) return null;

  const percent =
    rec.kind === "focus_target"
      ? 0
      : rec.kind === "lower_budget"
      ? -Math.max(1, Math.min(30, Math.round(Math.abs(rec.percent || 20))))
      : Math.max(1, Math.min(30, Math.round(Math.abs(rec.percent || 15))));

  const impactValue =
    rec.kind === "lower_budget"
      ? estimateSavings(match.totals.spend, percent)
      : rec.kind === "raise_budget"
      ? estimateExtraConversions(match.totals.conversions, percent)
      : estimateConversionRateDelta(
          match.totals.clicks > 0 ? (match.totals.conversions / match.totals.clicks) * 100 : 0,
          overallConversionRate(withTotals)
        );

  return {
    id: `ai-${rec.kind}-${match.c.id}`,
    tone: TONE_BY_KIND[rec.kind],
    title: rec.title,
    detail: rec.detail,
    buttonLabel: BUTTON_LABEL_BY_KIND[rec.kind],
    impactLabel: IMPACT_LABEL_BY_KIND[rec.kind],
    impactValue,
    campaignId: match.c.id,
    kind: rec.kind,
    percent,
  };
}

export interface CampaignSpotlight {
  id: string;
  tag: "best" | "rising" | "watch";
  campaignId: string;
  name: string;
  conversions: number;
  trendPct: number;
  series: number[];
}

function withSpotlightStats(campaigns: Campaign[]) {
  return campaigns
    .map((c) => ({
      c,
      totals: sumHistory(c.history.slice(-7)),
      trendPct: trendPercent(c.history, "conversions"),
      series: c.history.slice(-7).map((d) => d.conversions),
    }))
    .filter((w) => w.totals.spend > 0);
}

/**
 * "캠페인 한눈에 보기" 카드용 — 가장 잘하는 캠페인, 상승세인 캠페인, 개선이 필요한 캠페인을 최대 3개 뽑는다.
 * AI 분석이 불가능할 때 쓰는 규칙 기반 폴백. (실제 AI 경로는 hydrateWeeklySpotlight)
 */
export function buildCampaignSpotlights(campaigns: Campaign[]): CampaignSpotlight[] {
  const withStats = withSpotlightStats(campaigns);
  if (withStats.length === 0) return [];

  const results: CampaignSpotlight[] = [];
  const used = new Set<string>();

  const toSpotlight = (w: (typeof withStats)[number], tag: CampaignSpotlight["tag"]): CampaignSpotlight => ({
    id: `${tag}-${w.c.id}`,
    tag,
    campaignId: w.c.id,
    name: w.c.name,
    conversions: w.totals.conversions,
    trendPct: w.trendPct,
    series: w.series,
  });

  const best = [...withStats].sort((a, b) => b.totals.roas - a.totals.roas)[0];
  if (best) {
    results.push(toSpotlight(best, "best"));
    used.add(best.c.id);
  }

  const rising = [...withStats].filter((w) => !used.has(w.c.id)).sort((a, b) => b.trendPct - a.trendPct)[0];
  if (rising && rising.trendPct > 0) {
    results.push(toSpotlight(rising, "rising"));
    used.add(rising.c.id);
  }

  const watch = [...withStats].filter((w) => !used.has(w.c.id)).sort((a, b) => a.totals.roas - b.totals.roas)[0];
  if (watch) {
    results.push(toSpotlight(watch, "watch"));
  }

  return results.slice(0, 3);
}

/**
 * AI가 고른 스포트라이트(campaignId·tag)에 실제 캠페인 데이터를 붙인다.
 * campaignId가 실제 캠페인 목록에 없으면 null을 반환해 걸러낸다.
 */
export function hydrateWeeklySpotlight(campaigns: Campaign[], s: WeeklyAnalysisSpotlight): CampaignSpotlight | null {
  const withStats = withSpotlightStats(campaigns);
  const match = withStats.find((w) => w.c.id === s.campaignId);
  if (!match) return null;
  if (!["best", "rising", "watch"].includes(s.tag)) return null;

  return {
    id: `ai-${s.tag}-${match.c.id}`,
    tag: s.tag,
    campaignId: match.c.id,
    name: match.c.name,
    conversions: match.totals.conversions,
    trendPct: match.trendPct,
    series: match.series,
  };
}

export interface WeeklySummary {
  headline: string;
  highlight: string;
  subtitle: string;
  badge: string;
  healthy: boolean;
}

const FLAT_THRESHOLD = 5;

/**
 * 메인 대시보드 상단 "이번 주 핵심 요약" 문구 — 광고비/문의 증감 조합을 사람이 읽는 한 문장으로 요약한다.
 */
export function composeWeeklySummary(spendTrendPct: number, conversionsTrendPct: number): WeeklySummary {
  const pct = Math.round(Math.abs(conversionsTrendPct));

  if (conversionsTrendPct <= -10) {
    return {
      headline: `지난주보다 문의가 ${pct}% 줄었어요.`,
      highlight: `${pct}%`,
      subtitle: "AI가 찾은 개선 방법을 확인해보세요.",
      badge: "점검이 필요해요",
      healthy: false,
    };
  }

  if (Math.abs(spendTrendPct) < FLAT_THRESHOLD && conversionsTrendPct >= FLAT_THRESHOLD) {
    return {
      headline: `광고비는 비슷하지만, 문의가 ${pct}% 늘었어요.`,
      highlight: `${pct}%`,
      subtitle: "같은 광고비로 지난주보다 더 많은 성과를 얻었어요.",
      badge: "좋은 흐름을 이어가고 있어요!",
      healthy: true,
    };
  }

  if (spendTrendPct <= -FLAT_THRESHOLD && conversionsTrendPct >= 0) {
    return {
      headline: `광고비는 줄었는데, 문의는 ${pct}% 늘었어요.`,
      highlight: `${pct}%`,
      subtitle: "효율이 좋아지고 있어요.",
      badge: "좋은 흐름을 이어가고 있어요!",
      healthy: true,
    };
  }

  if (spendTrendPct >= FLAT_THRESHOLD && conversionsTrendPct >= FLAT_THRESHOLD) {
    return {
      headline: `광고비를 늘린 만큼, 문의도 ${pct}% 늘었어요.`,
      highlight: `${pct}%`,
      subtitle: "투자한 만큼 성과가 따라오고 있어요.",
      badge: "좋은 흐름을 이어가고 있어요!",
      healthy: true,
    };
  }

  return {
    headline: "지난주와 비슷한 성과를 유지하고 있어요.",
    highlight: "",
    subtitle: "AI가 더 좋은 실행안을 준비했어요.",
    badge: "안정적으로 운영되고 있어요",
    healthy: true,
  };
}

export type RankMetric = "spend" | "conversions" | "conversionRate";

export interface CampaignRankRow {
  campaignId: string;
  name: string;
  value: number;
  displayValue: string;
}

/**
 * "최근 7일 캠페인 성과" 카드용 — 캠페인을 선택한 지표 기준으로 최근 7일 합산 순위를 매긴다.
 */
export function rankCampaignsByMetric(campaigns: Campaign[], metric: RankMetric): CampaignRankRow[] {
  return campaigns
    .map((c) => {
      const totals = sumHistory(c.history.slice(-7));
      const value =
        metric === "spend"
          ? totals.spend
          : metric === "conversions"
          ? totals.conversions
          : totals.clicks > 0
          ? (totals.conversions / totals.clicks) * 100
          : 0;
      const displayValue =
        metric === "spend" ? `${formatKRW(totals.spend)}원` : metric === "conversions" ? `${totals.conversions}건` : `${value.toFixed(1)}%`;
      return { campaignId: c.id, name: c.name, value, displayValue };
    })
    .sort((a, b) => b.value - a.value);
}
