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

// 사용자가 직접 입력한 핵심 키워드를 메인 키워드로 삼는다. 없을 때는 캠페인 이름 → 업종 시드 순으로 폴백한다.
export function getMainKeyword(input: KeywordPromptInput): string {
  const core = input.coreKeyword?.trim();
  if (core && isMeaningfulToken(core.replace(/\s+/g, ""))) return core;

  const nameTokens = input.name.trim().split(/\s+/).filter(isMeaningfulToken);
  if (nameTokens.length > 0) return nameTokens.join(" ");

  return INDUSTRY_SEED_KEYWORD[input.industry];
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
  const mainKeyword = getMainKeyword(input);
  if (!mainKeyword) return null;

  try {
    const res = await fetch("/api/keywords/naver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mainKeyword,
        industry: input.industry,
        objective: input.objective,
        limit: options?.limit,
      }),
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
