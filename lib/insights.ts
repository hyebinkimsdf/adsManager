import type { Campaign } from "./mock/types";
import type { AssistantAction } from "./ai/types";
import { sumHistory, trendPercent } from "./mock/campaigns";
import { formatSignedPercent } from "./format";

export interface Insight {
  id: string;
  tone: "positive" | "negative" | "neutral";
  text: string;
}

export interface SimpleAction {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  action: AssistantAction;
}

/**
 * 간편 모드용 "지금 확인해주세요" 카드 — 전문 용어 없이 원인과 클릭 한 번짜리 조치를 묶어서 보여준다.
 */
export function buildSimpleActions(campaigns: Campaign[]): SimpleAction[] {
  const active = campaigns.filter((c) => c.status === "active" && c.targeting.keywords.length > 0);
  const results: SimpleAction[] = [];

  for (const c of active) {
    const totals = sumHistory(c.history);
    const clicksTrend = trendPercent(c.history, "clicks");

    if (totals.roas > 0 && totals.roas < 120) {
      results.push({
        id: `bid-down-${c.id}`,
        emoji: "💸",
        title: `${c.name}의 키워드 단가를 낮추면 좋겠어요`,
        detail: "쓴 돈에 비해 결과가 아직 적어요. 단가를 낮추면 돈을 아낄 수 있어요.",
        action: {
          id: `simple-bid-down-${c.id}`,
          type: "adjust_keyword_bids",
          label: "키워드 단가 10% 낮추기",
          description: `${c.name}의 키워드 단가를 10% 낮춰요.`,
          campaignId: c.id,
          percent: -10,
          riskLevel: "low",
        },
      });
    } else if (clicksTrend < -15) {
      results.push({
        id: `bid-up-${c.id}`,
        emoji: "📉",
        title: `${c.name}이 요즘 사람들 눈에 덜 띄고 있어요`,
        detail: "키워드 단가를 조금 올리면 다시 더 많이 보여질 수 있어요.",
        action: {
          id: `simple-bid-up-${c.id}`,
          type: "adjust_keyword_bids",
          label: "키워드 단가 10% 올리기",
          description: `${c.name}의 키워드 단가를 10% 올려요.`,
          campaignId: c.id,
          percent: 10,
          riskLevel: "low",
        },
      });
    }
  }

  return results.slice(0, 2);
}

export interface RoasBucket {
  key: "good" | "okay" | "bad";
  label: string;
  emoji: string;
  description: string;
  avgRoas: number;
  count: number;
}

const ROAS_GOOD_THRESHOLD = 250;
const ROAS_OKAY_THRESHOLD = 120;

/**
 * 간편 모드 캠페인 요약용 — ROAS 기준으로 캠페인을 좋아요/무난해요/아쉬워요 3단계로 나눈다.
 */
export function buildRoasBuckets(campaigns: Campaign[]): RoasBucket[] {
  const good: Campaign[] = [];
  const okay: Campaign[] = [];
  const bad: Campaign[] = [];

  for (const c of campaigns) {
    const roas = sumHistory(c.history).roas;
    if (roas >= ROAS_GOOD_THRESHOLD) good.push(c);
    else if (roas >= ROAS_OKAY_THRESHOLD) okay.push(c);
    else bad.push(c);
  }

  const avgRoas = (list: Campaign[]) =>
    list.length === 0 ? 0 : list.reduce((sum, c) => sum + sumHistory(c.history).roas, 0) / list.length;

  return [
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
  ];
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
