import crypto from "node:crypto";

const BASE_URL = "https://api.searchad.naver.com";
const KEYWORD_TOOL_PATH = "/keywordstool";
const MEDIAN_BID_PATH = "/estimate/median-bid/keyword";
const MIN_BID_PATH = "/estimate/exposure-minimum-bid/keyword";
const PERFORMANCE_PATH = "/estimate/performance/keyword";
const POSITION_BID_PATH = "/estimate/average-position-bid/keyword";
const MAX_HINT_KEYWORDS = 5;
const MAX_ESTIMATE_KEYWORDS = 20;
// 파워링크 노출 순위 중 대표적인 구간만 조회한다 (키워드 수 × 순위 수가 API 요청 크기가 됨)
const TARGET_POSITIONS = [1, 2, 3, 5];

export type NaverCompetition = "low" | "medium" | "high" | "unknown";

export interface NaverKeywordStat {
  keyword: string;
  monthlyPcSearches: number;
  monthlyMobileSearches: number;
  monthlySearches: number;
  competition: NaverCompetition;
  monthlyAdCount: number;
}

export interface PositionBid {
  position: number;
  bid: number;
}

export interface KeywordBidEstimate {
  keyword: string;
  /** 중간 입찰가 (추천 단가) */
  medianBid: number;
  /** 최소노출 입찰가 (이 밑으로는 노출 자체가 되지 않음) */
  minBid: number;
  /** medianBid로 입찰했을 때의 하루 예상 클릭수 */
  estimatedDailyClicks: number;
  /** medianBid로 입찰했을 때의 하루 예상 비용(원) */
  estimatedDailyCost: number;
  /** 순위별 평균 입찰가 (1위, 2위, 3위, 5위 등) */
  positionBids: PositionBid[];
}

const COMPETITION_MAP: Record<string, NaverCompetition> = {
  낮음: "low",
  중간: "medium",
  높음: "high",
};

function getCredentials() {
  const apiKey = process.env.NAVER_AD_API_KEY;
  const secretKey = process.env.NAVER_AD_SECRET_KEY;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  if (!apiKey || !secretKey || !customerId) {
    throw new Error("NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID 환경변수가 설정되지 않았습니다.");
  }
  return { apiKey, secretKey, customerId };
}

function sign(timestamp: string, method: string, path: string, secretKey: string): string {
  const message = `${timestamp}.${method}.${path}`;
  return crypto.createHmac("sha256", secretKey).update(message).digest("base64");
}

async function naverRequest<T>(method: "GET" | "POST", path: string, query?: string, body?: unknown): Promise<T> {
  const { apiKey, secretKey, customerId } = getCredentials();
  const timestamp = Date.now().toString();
  const signature = sign(timestamp, method, path, secretKey);
  const url = `${BASE_URL}${path}${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Timestamp": timestamp,
      "X-API-KEY": apiKey,
      "X-Customer": customerId,
      "X-Signature": signature,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`네이버 검색광고 API 오류 (${res.status})`);
  }
  return (await res.json()) as T;
}

// 네이버 검색광고 API는 검색량이 낮은 키워드를 "< 10"처럼 부등호 문자열로 내려준다.
function parseCount(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  if (value.trim().startsWith("<")) return 5;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface NaverKeywordToolItem {
  relKeyword?: string;
  monthlyPcQcCnt?: string | number;
  monthlyMobileQcCnt?: string | number;
  compIdx?: string;
  plAvgDepth?: string | number;
}

export function isNaverSearchAdConfigured(): boolean {
  return Boolean(
    process.env.NAVER_AD_API_KEY && process.env.NAVER_AD_SECRET_KEY && process.env.NAVER_AD_CUSTOMER_ID
  );
}

export async function fetchRelatedKeywords(seedKeywords: string[]): Promise<NaverKeywordStat[]> {
  // hintKeywords는 공백 없는 키워드를 콤마로 구분해 최대 5개까지 전달할 수 있다.
  const hintKeywords = Array.from(
    new Set(seedKeywords.map((k) => k.replace(/\s+/g, "")).filter(Boolean))
  )
    .slice(0, MAX_HINT_KEYWORDS)
    .join(",");
  if (!hintKeywords) return [];

  const query = `hintKeywords=${encodeURIComponent(hintKeywords)}&showDetail=1`;
  const data = await naverRequest<{ keywordList?: NaverKeywordToolItem[] }>("GET", KEYWORD_TOOL_PATH, query);
  const list = data.keywordList ?? [];

  return list
    .filter((item) => item.relKeyword)
    .map((item) => {
      const pc = parseCount(item.monthlyPcQcCnt);
      const mobile = parseCount(item.monthlyMobileQcCnt);
      return {
        keyword: item.relKeyword!,
        monthlyPcSearches: pc,
        monthlyMobileSearches: mobile,
        monthlySearches: pc + mobile,
        competition: COMPETITION_MAP[item.compIdx ?? ""] ?? "unknown",
        monthlyAdCount: parseCount(item.plAvgDepth),
      };
    });
}

interface NaverBidEstimateItem {
  keyword: string;
  bid: number;
}

interface NaverPerformanceItem {
  bid: number;
  clicks: number;
  impressions: number;
  cost: number;
}

interface NaverPositionBidItem {
  keyword: string;
  position: number;
  bid: number;
}

export async function fetchBidEstimates(keywords: string[]): Promise<KeywordBidEstimate[]> {
  const items = Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).slice(0, MAX_ESTIMATE_KEYWORDS);
  if (items.length === 0) return [];

  const positionItems = items.flatMap((keyword) =>
    TARGET_POSITIONS.map((position) => ({ key: keyword, position }))
  );

  const [median, minimum, positions] = await Promise.all([
    naverRequest<{ estimate: NaverBidEstimateItem[] }>("POST", MEDIAN_BID_PATH, undefined, {
      device: "PC",
      period: "MONTH",
      items,
    }),
    naverRequest<{ estimate: NaverBidEstimateItem[] }>("POST", MIN_BID_PATH, undefined, {
      device: "PC",
      period: "MONTH",
      items,
    }),
    naverRequest<{ estimate: NaverPositionBidItem[] }>("POST", POSITION_BID_PATH, undefined, {
      device: "PC",
      items: positionItems,
    }).catch(() => ({ estimate: [] as NaverPositionBidItem[] })),
  ]);

  const minMap = new Map(minimum.estimate.map((e) => [e.keyword, e.bid]));
  const positionMap = new Map<string, PositionBid[]>();
  for (const p of positions.estimate) {
    const list = positionMap.get(p.keyword) ?? [];
    list.push({ position: p.position, bid: p.bid });
    positionMap.set(p.keyword, list);
  }

  const performances = await Promise.all(
    median.estimate.map((e) =>
      naverRequest<{ keyword: string; estimate: NaverPerformanceItem[] }>("POST", PERFORMANCE_PATH, undefined, {
        device: "PC",
        keywordplus: true,
        key: e.keyword,
        bids: [e.bid],
      }).catch(() => null)
    )
  );

  return median.estimate.map((e, i) => {
    const perf = performances[i]?.estimate?.[0];
    return {
      keyword: e.keyword,
      medianBid: e.bid,
      minBid: minMap.get(e.keyword) ?? e.bid,
      estimatedDailyClicks: perf?.clicks ?? 0,
      estimatedDailyCost: perf?.cost ?? 0,
      positionBids: (positionMap.get(e.keyword) ?? []).sort((a, b) => a.position - b.position),
    };
  });
}

export interface PositionEstimate {
  bid: number;
  estimatedDailyClicks: number;
  estimatedDailyCost: number;
}

// 사용자가 직접 입력한 특정 순위 하나에 대한 입찰가와, 그 입찰가로 집행했을 때의 하루 예상 실적을 조회한다.
export async function fetchPositionEstimate(keyword: string, position: number): Promise<PositionEstimate | null> {
  const trimmed = keyword.trim();
  const bidData = await naverRequest<{ estimate: NaverPositionBidItem[] }>("POST", POSITION_BID_PATH, undefined, {
    device: "PC",
    items: [{ key: trimmed, position }],
  });
  const bid = bidData.estimate[0]?.bid;
  if (bid === undefined) return null;

  const perf = await naverRequest<{ keyword: string; estimate: NaverPerformanceItem[] }>(
    "POST",
    PERFORMANCE_PATH,
    undefined,
    { device: "PC", keywordplus: true, key: trimmed, bids: [bid] }
  ).catch(() => null);
  const item = perf?.estimate?.[0];

  return {
    bid,
    estimatedDailyClicks: item?.clicks ?? 0,
    estimatedDailyCost: item?.cost ?? 0,
  };
}
