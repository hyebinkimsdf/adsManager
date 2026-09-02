import { CHANNEL_LABEL, OBJECTIVE_LABEL } from "../mock/campaigns";
import { INDUSTRY_SEED_KEYWORD } from "./keywordHeuristics";
import type { KeywordPromptInput } from "./keywordPrompt";
import type { KeywordMatchType, KeywordSuggestion } from "./types";

interface NaverKeywordStatDto {
  keyword: string;
  monthlySearches: number;
  competition: "low" | "medium" | "high" | "unknown";
  tier: "core" | "sub";
}

// "캠페인", "전환", "검색" 같은 위저드 라벨용 메타 단어는 실제 검색어가 아니므로 시드에서 제외한다.
const GENERIC_STOPWORDS = new Set<string>([
  ...Object.values(CHANNEL_LABEL),
  ...Object.values(OBJECTIVE_LABEL).flatMap((label) => label.split(/\s+/)),
  "캠페인",
  "광고",
  "마케팅",
]);

function isMeaningfulToken(token: string): boolean {
  if (!token || GENERIC_STOPWORDS.has(token)) return false;
  // 구두점(·, -, / 등)만으로 이뤄진 토큰은 제외한다.
  return /[가-힣a-zA-Z0-9]/.test(token);
}

// 사용자가 직접 입력한 캠페인 이름(비어있을 수 있음)에서 의미 있는 단어만 골라
// 업종 시드 키워드와 합쳐 네이버 키워드도구 hintKeywords를 구성한다.
export function buildSeedKeywords(input: KeywordPromptInput): string[] {
  const nameTokens = Array.from(new Set(input.name.trim().split(/\s+/).filter(isMeaningfulToken))).slice(0, 4);
  // 업종 시드는 이름에서 유의미한 단어를 못 찾았을 때의 최후 폴백이 아니라, 항상 포함되도록 보장한다.
  return Array.from(new Set([...nameTokens, INDUSTRY_SEED_KEYWORD[input.industry]]));
}

function toMatchType(competition: NaverKeywordStatDto["competition"]): KeywordMatchType {
  if (competition === "high") return "exact";
  if (competition === "low") return "broad";
  return "phrase";
}

export async function fetchNaverKeywordSuggestions(
  input: KeywordPromptInput,
  options?: { limit?: number }
): Promise<KeywordSuggestion[] | null> {
  const seedKeywords = buildSeedKeywords(input);
  if (seedKeywords.length === 0) return null;

  try {
    const res = await fetch("/api/keywords/naver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedKeywords, limit: options?.limit }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { keywords?: NaverKeywordStatDto[] };
    if (!data.keywords || data.keywords.length === 0) return null;

    return data.keywords.map((stat) => ({
      keyword: stat.keyword,
      matchType: toMatchType(stat.competition),
      monthlySearches: stat.monthlySearches,
      competition: stat.competition === "unknown" ? undefined : stat.competition,
      tier: stat.tier,
    }));
  } catch {
    return null;
  }
}
