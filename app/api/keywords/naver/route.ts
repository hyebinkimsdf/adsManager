import { NextResponse } from "next/server";
import { fetchRelatedKeywords, isNaverSearchAdConfigured, type NaverKeywordStat } from "@/lib/ads/naverSearchAd";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 500;

// 시드 키워드 자체이거나 검색량 상위 구간(요청 개수의 20%, 최소 3 · 최대 30개)에 든 키워드를 "핵심"으로 분류한다.
function classifyTiers(stats: NaverKeywordStat[], seedKeywords: string[], limit: number) {
  const seedSet = new Set(seedKeywords.map((s) => s.replace(/\s+/g, "")));
  const coreCount = Math.max(3, Math.min(30, Math.round(limit * 0.2)));
  return stats.map((s, i) => ({
    ...s,
    tier: seedSet.has(s.keyword) || i < coreCount ? ("core" as const) : ("sub" as const),
  }));
}

export async function POST(req: Request) {
  if (!isNaverSearchAdConfigured()) {
    return NextResponse.json({ error: "네이버 검색광고 API가 설정되지 않았습니다." }, { status: 501 });
  }

  let seedKeywords: string[] = [];
  let limit = DEFAULT_LIMIT;
  try {
    const body = (await req.json()) as { seedKeywords?: string[]; limit?: number };
    seedKeywords = Array.isArray(body.seedKeywords) ? body.seedKeywords : [];
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.max(1, Math.min(MAX_LIMIT, Math.round(body.limit)));
    }
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (seedKeywords.length === 0) {
    return NextResponse.json({ error: "seedKeywords가 필요합니다." }, { status: 400 });
  }

  try {
    const stats = await fetchRelatedKeywords(seedKeywords);
    stats.sort((a, b) => b.monthlySearches - a.monthlySearches);
    const sliced = stats.slice(0, limit);
    return NextResponse.json({ keywords: classifyTiers(sliced, seedKeywords, limit) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
