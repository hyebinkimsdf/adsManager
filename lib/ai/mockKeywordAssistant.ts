import { CHANNEL_LABEL, INDUSTRY_LABEL, OBJECTIVE_LABEL } from "../mock/campaigns";
import { INDUSTRY_TAILS, OBJECTIVE_TAILS } from "./keywordHeuristics";
import type { KeywordPromptInput } from "./keywordPrompt";
import type { KeywordSuggestion, KeywordSuggestionReply } from "./types";

export function mockKeywordSuggestions(input: KeywordPromptInput): KeywordSuggestionReply {
  const base = input.name.trim() || `${INDUSTRY_LABEL[input.industry]} ${OBJECTIVE_LABEL[input.objective]}`;
  const tokens = base.split(/\s+/).filter(Boolean);
  const keywords: KeywordSuggestion[] = [];

  keywords.push({ keyword: base, matchType: "exact" });
  for (const tail of INDUSTRY_TAILS[input.industry]) {
    keywords.push({ keyword: `${base} ${tail}`, matchType: "phrase" });
  }
  for (const tail of OBJECTIVE_TAILS[input.objective]) {
    keywords.push({ keyword: `${base} ${tail}`, matchType: "phrase" });
  }
  if (tokens.length > 1) {
    keywords.push({ keyword: tokens[0], matchType: "broad" });
  }
  for (const ch of input.channels) {
    keywords.push({ keyword: `${CHANNEL_LABEL[ch]} 광고`, matchType: "broad" });
  }

  const seen = new Set<string>();
  const deduped = keywords.filter((k) => {
    if (seen.has(k.keyword)) return false;
    seen.add(k.keyword);
    return true;
  });

  return { keywords: deduped.slice(0, 7) };
}
