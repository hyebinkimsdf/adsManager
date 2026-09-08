import { NextResponse } from "next/server";
import {
  fetchExactKeywordStats,
  fetchRelatedKeywords,
  isNaverSearchAdConfigured,
  type NaverKeywordStat,
} from "@/lib/ads/naverSearchAd";
import { GENERIC_MODIFIERS, INDUSTRY_TAILS, OBJECTIVE_TAILS } from "@/lib/ai/keywordHeuristics";
import type { CampaignIndustry, CampaignObjective } from "@/lib/mock/types";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 500;

type Tiered<T> = T & { tier: "core" | "sub" };

function zeroStat(keyword: string): NaverKeywordStat {
  return {
    keyword,
    monthlyPcSearches: 0,
    monthlyMobileSearches: 0,
    monthlySearches: 0,
    competition: "unknown",
    monthlyAdCount: 0,
  };
}

// 광고 대행사가 흔히 쓰는 "메인 키워드 + 수식어" 조합(예: 필라테스 + 위치 → 필라테스 위치)을 만든다.
// 메인 키워드가 여러 개면 각각에 대해 조합을 만든다.
function buildComboKeywords(mainKeywords: string[], industry?: CampaignIndustry, objective?: CampaignObjective): string[] {
  const tails = new Set(GENERIC_MODIFIERS);
  if (industry && INDUSTRY_TAILS[industry]) INDUSTRY_TAILS[industry].forEach((t) => tails.add(t));
  if (objective && OBJECTIVE_TAILS[objective]) OBJECTIVE_TAILS[objective].forEach((t) => tails.add(t));
  const combos: string[] = [];
  for (const main of mainKeywords) {
    for (const tail of tails) combos.push(`${main} ${tail}`);
  }
  return combos;
}

export async function POST(req: Request) {
  if (!isNaverSearchAdConfigured()) {
    return NextResponse.json({ error: "네이버 검색광고 API가 설정되지 않았습니다." }, { status: 501 });
  }

  let mainKeywords: string[] = [];
  let limit = DEFAULT_LIMIT;
  let industry: CampaignIndustry | undefined;
  let objective: CampaignObjective | undefined;
  try {
    const body = (await req.json()) as {
      mainKeywords?: string[];
      limit?: number;
      industry?: CampaignIndustry;
      objective?: CampaignObjective;
    };
    mainKeywords = Array.isArray(body.mainKeywords)
      ? Array.from(new Set(body.mainKeywords.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)))
      : [];
    industry = body.industry;
    objective = body.objective;
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.max(1, Math.min(MAX_LIMIT, Math.round(body.limit)));
    }
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (mainKeywords.length === 0) {
    return NextResponse.json({ error: "mainKeywords가 필요합니다." }, { status: 400 });
  }

  try {
    const comboKeywords = buildComboKeywords(mainKeywords, industry, objective);
    const mainKeys = mainKeywords.map((k) => k.replace(/\s+/g, ""));

    const [mainStatsMap, comboStatsMap] = await Promise.all([
      fetchExactKeywordStats(mainKeywords),
      fetchExactKeywordStats(comboKeywords),
    ]);

    const cores: Tiered<NaverKeywordStat>[] = mainKeywords.map((kw, i) => ({
      ...(mainStatsMap.get(mainKeys[i]) ?? zeroStat(kw)),
      tier: "core" as const,
    }));

    const combos: Tiered<NaverKeywordStat>[] = comboKeywords
      .map((kw) => ({
        ...(comboStatsMap.get(kw.replace(/\s+/g, "")) ?? zeroStat(kw)),
        tier: "sub" as const,
      }))
      .sort((a, b) => b.monthlySearches - a.monthlySearches);

    // 조합 키워드만으로 원하는 개수를 못 채우는 경우(보통·대량 모드)에만
    // 네이버의 폭넓은 연관 키워드 발굴로 부족분을 보충한다.
    const usedSoFar = cores.length + combos.length;
    let extra: Tiered<NaverKeywordStat>[] = [];
    if (limit > usedSoFar) {
      const broad = await fetchRelatedKeywords(mainKeywords);
      const used = new Set([...mainKeys, ...comboKeywords.map((k) => k.replace(/\s+/g, ""))]);
      extra = broad
        .filter((k) => !used.has(k.keyword))
        .sort((a, b) => b.monthlySearches - a.monthlySearches)
        .slice(0, limit - usedSoFar)
        .map((k) => ({ ...k, tier: "sub" as const }));
    }

    const keywords = [...cores, ...combos, ...extra].slice(0, limit);
    return NextResponse.json({ keywords });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
