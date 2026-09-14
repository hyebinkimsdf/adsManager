import type { Campaign, DayMetric } from "./mock/types";
import { sumHistory, trendPercent } from "./mock/campaigns";
import { formatKRW, formatSignedPercent } from "./format";

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
 * "이번 주 추천 액션" 카드의 판단(어떤 캠페인을, 어떻게, 몇 % 바꿀지)과 설명 문구를 모두 규칙으로
 * 결정한다. campaignId/kind/percent가 3가지 kind로 한정돼 있고 설명에 필요한 수치도 이미 다 갖고
 * 있어서, title/detail도 AI에게 새로 쓰게 하지 않고 여기서 숫자를 그대로 문장에 끼워 넣는다.
 */
export interface DecidedRecommendation {
  id: string;
  campaignId: string;
  campaignName: string;
  kind: WeeklyRecommendation["kind"];
  tone: WeeklyRecommendation["tone"];
  percent: number;
  buttonLabel: string;
  impactLabel: string;
  impactValue: string;
  title: string;
  detail: string;
}

function decideWeeklyRecommendations(campaigns: Campaign[]): DecidedRecommendation[] {
  const withTotals = withLast7Totals(campaigns);
  const results: DecidedRecommendation[] = [];

  const worst = [...withTotals].sort((a, b) => a.totals.roas - b.totals.roas)[0];
  if (worst && worst.totals.roas < 150) {
    const percent = -20;
    results.push({
      id: `low-eff-${worst.c.id}`,
      campaignId: worst.c.id,
      campaignName: worst.c.name,
      kind: "lower_budget",
      tone: "warning",
      percent,
      buttonLabel: "적용하기",
      impactLabel: "예상 절감 금액",
      impactValue: estimateSavings(worst.totals.spend, percent),
      title: `${worst.c.name}의 예산을 줄이는 게 좋아요`,
      detail: `최근 7일간 ${formatKRW(worst.totals.spend)}원이 사용됐지만, 전환이 ${
        worst.totals.conversions === 0 ? "없었어요" : "적었어요"
      }.`,
    });
  }

  const best = [...withTotals]
    .filter((w) => w.c.id !== worst?.c.id)
    .sort((a, b) => b.totals.roas - a.totals.roas)[0];
  if (best && best.totals.roas >= 150) {
    const percent = 15;
    results.push({
      id: `raise-budget-${best.c.id}`,
      campaignId: best.c.id,
      campaignName: best.c.name,
      kind: "raise_budget",
      tone: "positive",
      percent,
      buttonLabel: "적용하기",
      impactLabel: "예상 추가 전환",
      impactValue: estimateExtraConversions(best.totals.conversions, percent),
      title: "성과가 좋은 캠페인의 예산을 늘려보세요",
      detail: `${best.c.name}의 예산을 15% 늘리면, 더 많은 전환을 기대할 수 있어요.`,
    });
  }

  const topConversion = [...withTotals].sort((a, b) => b.totals.conversions - a.totals.conversions)[0];
  if (topConversion && topConversion.totals.conversions > 0) {
    const overallRate = overallConversionRate(withTotals);
    const topRate = topConversion.totals.clicks > 0 ? (topConversion.totals.conversions / topConversion.totals.clicks) * 100 : 0;
    results.push({
      id: `target-${topConversion.c.id}`,
      campaignId: topConversion.c.id,
      campaignName: topConversion.c.name,
      kind: "focus_target",
      tone: "info",
      percent: 0,
      buttonLabel: "설정하기",
      impactLabel: "예상 전환율",
      impactValue: estimateConversionRateDelta(topRate, overallRate),
      title: `${topConversion.c.targeting.ageRange.replace("-", "~")}세 타겟에 더 집중해보세요`,
      detail: "이 연령대에서 문의가 가장 많아요.",
    });
  }

  return results.slice(0, 3);
}

/**
 * 메인 대시보드 "이번 주 추천 액션" 카드용 — 판단(campaignId/kind/percent)과 설명 문구(title/detail)
 * 모두 규칙 엔진이 결정한다. AI 생성·번역 왕복 없이 항상 즉시, 동일하게 만들어진다.
 */
export function buildWeeklyRecommendations(campaigns: Campaign[]): WeeklyRecommendation[] {
  return decideWeeklyRecommendations(campaigns).map((d) => ({
    id: d.id,
    tone: d.tone,
    title: d.title,
    detail: d.detail,
    buttonLabel: d.buttonLabel,
    impactLabel: d.impactLabel,
    impactValue: d.impactValue,
    campaignId: d.campaignId,
    kind: d.kind,
    percent: d.percent,
  }));
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

/** 캠페인별 최근 N일 지표 합산 — 캠페인 수와 무관하게 전체를 한 번 순회한다. */
export function combine(campaigns: Campaign[], days: number, key: keyof DayMetric): number {
  return campaigns.reduce((sum, c) => {
    const slice = c.history.slice(-days);
    return sum + slice.reduce((s, d) => s + (d[key] as number), 0);
  }, 0);
}

/** 최근 7일 대비 그 이전 7일(8~14일 전) 증감률. */
export function trend(campaigns: Campaign[], key: keyof DayMetric): number {
  const recent = combine(campaigns, 7, key);
  const previous = combine(campaigns, 14, key) - recent;
  if (previous === 0) return 0;
  return ((recent - previous) / previous) * 100;
}

const TOP_CAMPAIGNS_LIMIT = 20;
const RECENT_CAMPAIGNS_LIMIT = 4;

/**
 * 최근 7일 지출 기준 상위 N개 캠페인만 추린다 — `decideWeeklyRecommendations`의 판단 대상과
 * AssistantDock 컨텍스트가 전체 캠페인 수와 무관하게 일정한 크기를 유지하도록 하기 위함.
 */
export function pickTopCampaignsBySpend(campaigns: Campaign[], limit = TOP_CAMPAIGNS_LIMIT): Campaign[] {
  return [...campaigns]
    .map((c) => ({ c, spend: sumHistory(c.history.slice(-7)).spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit)
    .map((w) => w.c);
}

export interface DashboardSummary {
  totalCampaignCount: number;
  metricSources?: { live: number; demo: number; unverified: number };
  today: { spend: number; conversions: number; clicks: number };
  last7: { spend: number; revenue: number; conversions: number; roas: number };
  prev7: { spend: number; conversions: number };
  trendPct: { spend: number; conversions: number; revenue: number; clicks: number };
  insights: Insight[];
  weeklyRecommendations: WeeklyRecommendation[];
  /** createdAt DESC 기준 최신 4건 — 호출부가 이미 그 순서로 정렬해 넘겨야 한다. */
  recentCampaigns: Campaign[];
  topCampaigns: Campaign[];
}

/**
 * 홈 대시보드가 필요로 하는 요약값을 한 번에 계산한다. 원래 `app/page.tsx`에서 매 렌더마다
 * 클라이언트가 전체 캠페인 배열을 순회해 계산하던 것을 그대로 옮긴 것 — 로직 재구현이 아니라
 * 서버(API 라우트)에서 실행해 결과 요약만 응답으로 내려보내기 위한 위치 이동이다.
 */
export function buildDashboardSummary(campaigns: Campaign[]): DashboardSummary {
  const last7Spend = combine(campaigns, 7, "spend");
  const last7Revenue = combine(campaigns, 7, "revenue");
  const last7Conversions = combine(campaigns, 7, "conversions");
  return {
    totalCampaignCount: campaigns.length,
    metricSources: {
      live: campaigns.filter(c => c.metricSource === "live").length,
      demo: campaigns.filter(c => c.metricSource === "demo").length,
      unverified: campaigns.filter(c => c.metricSource !== "live" && c.metricSource !== "demo").length,
    },
    today: {
      spend: campaigns.reduce((s, c) => s + (c.history.at(-1)?.spend ?? 0), 0),
      conversions: campaigns.reduce((s, c) => s + (c.history.at(-1)?.conversions ?? 0), 0),
      clicks: campaigns.reduce((s, c) => s + (c.history.at(-1)?.clicks ?? 0), 0),
    },
    last7: {
      spend: last7Spend,
      revenue: last7Revenue,
      conversions: last7Conversions,
      roas: last7Spend > 0 ? (last7Revenue / last7Spend) * 100 : 0,
    },
    prev7: {
      spend: combine(campaigns, 14, "spend") - last7Spend,
      conversions: combine(campaigns, 14, "conversions") - last7Conversions,
    },
    trendPct: {
      spend: trend(campaigns, "spend"),
      conversions: trend(campaigns, "conversions"),
      revenue: trend(campaigns, "revenue"),
      clicks: trend(campaigns, "clicks"),
    },
    insights: buildInsights(campaigns),
    weeklyRecommendations: buildWeeklyRecommendations(campaigns),
    recentCampaigns: campaigns.slice(0, RECENT_CAMPAIGNS_LIMIT),
    topCampaigns: pickTopCampaignsBySpend(campaigns),
  };
}
