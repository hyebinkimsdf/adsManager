import type { Campaign, CampaignTotals, DayMetric, DisplayObjective } from "./types";

// 시드 고정 PRNG — 서버/클라이언트 렌더링이 항상 동일한 값을 내도록 함(hydration mismatch 방지)
export function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHistory(seed: number, baseSpend: number, trend: number): DayMetric[] {
  const rand = mulberry32(seed);
  const days: DayMetric[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayIndex = 13 - i;
    const trendFactor = 1 + (trend * dayIndex) / 13;
    const noise = 0.85 + rand() * 0.3;
    const spend = Math.round(baseSpend * trendFactor * noise);
    const cpc = 350 + rand() * 450;
    const clicks = Math.max(1, Math.round(spend / cpc));
    const ctrBase = 1.2 + rand() * 2.4;
    const impressions = Math.max(clicks, Math.round((clicks / ctrBase) * 100));
    const convRate = 0.02 + rand() * 0.06;
    const conversions = Math.round(clicks * convRate);
    const aov = 18000 + rand() * 42000;
    const revenue = Math.round(conversions * aov);
    days.push({
      label: `D-${i}`,
      spend,
      impressions,
      clicks,
      conversions,
      revenue,
    });
  }
  return days;
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: "camp-purchase-shopping",
    name: "쇼핑몰 구매 전환 캠페인",
    adType: "display",
    objective: "purchase",
    industry: "shopping",
    status: "active",
    dailyBudget: 120000,
    targeting: {
      ageRange: "25-44",
      gender: "all",
      regions: ["서울", "경기"],
      interests: ["온라인 쇼핑", "패션"],
    },
    history: buildHistory(11, 118000, 0.15),
    metricSource: "demo",
  },
  {
    id: "camp-visit-newlaunch",
    name: "신제품 런칭 · 방문 유도",
    adType: "display",
    objective: "visit",
    industry: "beauty",
    status: "active",
    dailyBudget: 90000,
    targeting: {
      ageRange: "20-34",
      gender: "female",
      regions: ["전국"],
      interests: ["뷰티", "라이프스타일"],
    },
    history: buildHistory(27, 85000, -0.22),
    metricSource: "demo",
  },
  {
    id: "camp-purchase-retarget",
    name: "리타겟팅 구매 유도",
    adType: "display",
    objective: "purchase",
    industry: "shopping",
    status: "active",
    dailyBudget: 60000,
    targeting: {
      ageRange: "전체",
      gender: "all",
      regions: ["전국"],
      interests: ["장바구니 이탈"],
    },
    history: buildHistory(41, 58000, 0.35),
    metricSource: "demo",
  },
  {
    id: "camp-appinstall-service",
    name: "앱 설치 유도 · 신규 서비스",
    adType: "display",
    objective: "app_install",
    industry: "it_app",
    status: "paused",
    dailyBudget: 150000,
    targeting: {
      ageRange: "18-29",
      gender: "all",
      regions: ["서울", "부산", "인천"],
      interests: ["앱테크", "테크 얼리어답터"],
    },
    history: buildHistory(59, 140000, -0.05),
    metricSource: "demo",
  },
  {
    id: "camp-leads-finance",
    name: "상담 신청 · 잠재고객",
    adType: "display",
    objective: "leads",
    industry: "finance",
    status: "active",
    dailyBudget: 70000,
    targeting: {
      ageRange: "35-54",
      gender: "all",
      regions: ["전국"],
      interests: ["금융", "재테크"],
    },
    history: buildHistory(73, 68000, 0.08),
    metricSource: "demo",
  },
];

export function sumHistory(history: DayMetric[]): CampaignTotals {
  const totals = history.reduce(
    (acc, day) => ({
      spend: acc.spend + day.spend,
      impressions: acc.impressions + day.impressions,
      clicks: acc.clicks + day.clicks,
      conversions: acc.conversions + day.conversions,
      revenue: acc.revenue + day.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );
  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    roas: totals.spend > 0 ? (totals.revenue / totals.spend) * 100 : 0,
  };
}

export function last7(history: DayMetric[]): DayMetric[] {
  return history.slice(-7);
}

export function trendPercent(history: DayMetric[], key: keyof DayMetric): number {
  const half = Math.floor(history.length / 2);
  const first = history.slice(0, half).reduce((s, d) => s + (d[key] as number), 0);
  const second = history.slice(half).reduce((s, d) => s + (d[key] as number), 0);
  if (first === 0) return 0;
  return ((second - first) / first) * 100;
}

export const INDUSTRY_LABEL: Record<Campaign["industry"], string> = {
  food: "외식·카페",
  beauty: "뷰티",
  education: "교육·학원",
  medical: "병원·의료",
  shopping: "쇼핑몰·이커머스",
  realestate: "부동산",
  finance: "금융",
  it_app: "IT·앱 서비스",
  etc: "기타",
};

export const OBJECTIVE_LABEL: Record<DisplayObjective, string> = {
  purchase: "구매 유도",
  app_install: "앱 설치 유도",
  leads: "잠재고객 모으기",
  visit: "방문 유도",
};
