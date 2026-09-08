import { CHANNEL_LABEL, INDUSTRY_LABEL, OBJECTIVE_LABEL } from "../mock/campaigns";
import { GENERIC_MODIFIERS, INDUSTRY_TAILS, OBJECTIVE_TAILS } from "./keywordHeuristics";
import type { KeywordPromptInput } from "./keywordPrompt";
import type { KeywordSuggestion, KeywordSuggestionReply } from "./types";

export function mockKeywordSuggestions(input: KeywordPromptInput): KeywordSuggestionReply {
  const cores = (input.coreKeywords ?? []).map((k) => k.trim()).filter(Boolean);
  const bases =
    cores.length > 0
      ? cores
      : [input.name.trim() || `${INDUSTRY_LABEL[input.industry]} ${OBJECTIVE_LABEL[input.objective]}`];

  // core 항목은 절대 잘리지 않도록 sub 항목과 분리해서 모은다. 예전에는 base(핵심 키워드)마다
  // 조합을 순서대로 만든 뒤 배열 전체를 한 번에 slice했는데, 첫 번째 핵심 키워드의 조합만으로도
  // 상한을 넘겨버려서 두 번째 이후 핵심 키워드가 통째로 잘려나가는 문제가 있었다.
  const coreEntries: KeywordSuggestion[] = [];
  const subEntries: KeywordSuggestion[] = [];

  for (const base of bases) {
    const tokens = base.split(/\s+/).filter(Boolean);
    coreEntries.push({ keyword: base, matchType: "exact", tier: "core" });
    if (tokens.length > 1) {
      coreEntries.push({ keyword: tokens[0], matchType: "broad", tier: "core" });
    }
    for (const tail of GENERIC_MODIFIERS) {
      subEntries.push({ keyword: `${base} ${tail}`, matchType: "phrase", tier: "sub" });
    }
    for (const tail of INDUSTRY_TAILS[input.industry]) {
      subEntries.push({ keyword: `${base} ${tail}`, matchType: "phrase", tier: "sub" });
    }
    for (const tail of OBJECTIVE_TAILS[input.objective]) {
      subEntries.push({ keyword: `${base} ${tail}`, matchType: "phrase", tier: "sub" });
    }
  }
  for (const ch of input.channels) {
    subEntries.push({ keyword: `${CHANNEL_LABEL[ch]} 광고`, matchType: "broad", tier: "sub" });
  }

  const seen = new Set<string>();
  function dedupe(list: KeywordSuggestion[]) {
    return list.filter((k) => {
      if (seen.has(k.keyword)) return false;
      seen.add(k.keyword);
      return true;
    });
  }

  const dedupedCore = dedupe(coreEntries);
  const dedupedSub = dedupe(subEntries);
  const subCap = Math.max(7, bases.length * 6);

  return { keywords: [...dedupedCore, ...dedupedSub.slice(0, subCap)] };
}
