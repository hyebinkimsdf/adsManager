import type { Campaign, CampaignChannel, CampaignTotals, DayMetric } from "./types";

// 시드 고정 PRNG — 서버/클라이언트 렌더링이 항상 동일한 값을 내도록 함(hydration mismatch 방지)
function mulberry32(seed: number) {
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
    id: "camp-search-brand",
    name: "브랜드 검색 캠페인",
    channels: ["search"],
    objective: "conversion",
    industry: "shopping",
    status: "active",
    dailyBudget: 120000,
    targeting: {
      ageRange: "25-44",
      gender: "all",
      regions: ["서울", "경기"],
      interests: ["브랜드 검색"],
      keywords: ["브랜드명 구매", "브랜드명 할인", "브랜드명 후기"],
    },
    history: buildHistory(11, 118000, 0.15),
  },
  {
    id: "camp-social-newlaunch",
    name: "신제품 런칭 · 소셜",
    channels: ["social"],
    objective: "traffic",
    industry: "beauty",
    status: "active",
    dailyBudget: 90000,
    targeting: {
      ageRange: "20-34",
      gender: "female",
      regions: ["전국"],
      interests: ["뷰티", "라이프스타일"],
      keywords: ["신제품 추천", "여성 뷰티템"],
    },
    history: buildHistory(27, 85000, -0.22),
  },
  {
    id: "camp-display-retarget",
    name: "리타겟팅 디스플레이",
    channels: ["display"],
    objective: "conversion",
    industry: "shopping",
    status: "active",
    dailyBudget: 60000,
    targeting: {
      ageRange: "전체",
      gender: "all",
      regions: ["전국"],
      interests: ["장바구니 이탈"],
      keywords: [],
    },
    history: buildHistory(41, 58000, 0.35),
  },
  {
    id: "camp-video-awareness",
    name: "브랜드 인지도 · 영상",
    channels: ["video", "display"],
    objective: "awareness",
    industry: "etc",
    status: "paused",
    dailyBudget: 150000,
    targeting: {
      ageRange: "18-29",
      gender: "all",
      regions: ["서울", "부산", "인천"],
      interests: ["엔터테인먼트"],
      keywords: [],
    },
    history: buildHistory(59, 140000, -0.05),
  },
  {
    id: "camp-social-leads",
    name: "상담 신청 · 리드",
    channels: ["social", "search"],
    objective: "leads",
    industry: "finance",
    status: "active",
    dailyBudget: 70000,
    targeting: {
      ageRange: "35-54",
      gender: "all",
      regions: ["전국"],
      interests: ["금융", "재테크"],
      keywords: ["무료 상담 신청", "재테크 상담"],
    },
    history: buildHistory(73, 68000, 0.08),
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

export const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  search: "검색",
  social: "소셜",
  display: "디스플레이",
  video: "영상",
};

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

export const OBJECTIVE_LABEL: Record<Campaign["objective"], string> = {
  conversion: "전환",
  traffic: "트래픽",
  awareness: "인지도",
  leads: "리드 수집",
};
