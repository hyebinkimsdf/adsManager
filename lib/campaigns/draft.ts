import type { Campaign, CampaignChannel, CampaignIndustry, CampaignObjective } from "@/lib/mock/types";

export const QUICK_DRAFT_KEY = "ads-quick-campaign-draft-v1";
const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export interface QuickCampaignDraft {
  step: 0 | 1 | 2;
  name: string;
  description: string;
  coreKeyword: string;
  keywords: string[];
  industry: CampaignIndustry;
  objective: CampaignObjective;
  budget: string;
  channels: CampaignChannel[];
  age: string;
  gender: "all" | "male" | "female";
  region: string;
}

export const DEFAULT_QUICK_DRAFT: QuickCampaignDraft = {
  step: 0,
  name: "",
  description: "",
  coreKeyword: "",
  keywords: [],
  industry: "etc",
  objective: "traffic",
  budget: "30000",
  channels: ["search"],
  age: "전체",
  gender: "all",
  region: "전국",
};

const INDUSTRIES: CampaignIndustry[] = ["food", "beauty", "education", "medical", "shopping", "realestate", "finance", "it_app", "etc"];
const OBJECTIVES: CampaignObjective[] = ["conversion", "traffic", "awareness", "leads"];
const CHANNELS: CampaignChannel[] = ["search", "social", "display", "video"];
export const QUICK_AGES = ["전체", "10대", "20대", "30대", "40대", "50대 이상"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

export function parseQuickDraft(raw: string | null, now = Date.now()): QuickCampaignDraft | null {
  if (!raw || raw.length > 20000) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || saved.version !== DRAFT_VERSION || typeof saved.savedAt !== "number") return null;
    if (!Number.isFinite(saved.savedAt) || saved.savedAt > now || now - saved.savedAt > DRAFT_MAX_AGE) return null;
    const draft = saved.draft;
    if (!isRecord(draft)) return null;
    if (draft.step !== 0 && draft.step !== 1 && draft.step !== 2) return null;
    if (!isText(draft.name, 100) || !isText(draft.description, 300) || !isText(draft.coreKeyword, 100)) return null;
    if (!isText(draft.budget, 9) || !/^\d*$/.test(draft.budget) || Number(draft.budget) > 100000000) return null;
    if (!Array.isArray(draft.keywords) || draft.keywords.length > 30 || !draft.keywords.every((item) => isText(item, 100) && item.trim().length > 0)) return null;
    if (!INDUSTRIES.includes(draft.industry as CampaignIndustry) || !OBJECTIVES.includes(draft.objective as CampaignObjective)) return null;
    if (!Array.isArray(draft.channels) || draft.channels.length === 0 || draft.channels.length > 4 || !draft.channels.every((channel) => CHANNELS.includes(channel))) return null;
    if (!isText(draft.age, 20) || !QUICK_AGES.includes(draft.age)) return null;
    if (draft.gender !== "all" && draft.gender !== "male" && draft.gender !== "female") return null;
    if (!isText(draft.region, 100)) return null;
    return {
      step: draft.step,
      name: draft.name,
      description: draft.description,
      coreKeyword: draft.coreKeyword,
      keywords: [...new Set(draft.keywords as string[])],
      industry: draft.industry as CampaignIndustry,
      objective: draft.objective as CampaignObjective,
      budget: draft.budget,
      channels: [...new Set(draft.channels as CampaignChannel[])],
      age: draft.age,
      gender: draft.gender,
      region: draft.region,
    };
  } catch {
    return null;
  }
}

export function serializeQuickDraft(draft: QuickCampaignDraft, now = Date.now()): string {
  return JSON.stringify({ version: DRAFT_VERSION, savedAt: now, draft });
}

export function getQuickDraftError(draft: QuickCampaignDraft, step = draft.step): string | null {
  if (!draft.name.trim()) return "광고할 가게나 브랜드 이름을 입력해 주세요.";
  if (!draft.coreKeyword.trim()) return "고객이 검색할 핵심 검색어를 하나 입력해 주세요.";
  if (step >= 1) {
    const budget = Number(draft.budget);
    if (!Number.isInteger(budget) || budget < 1000 || budget > 100000000) return "하루 예산은 1,000원부터 1억원까지 입력해 주세요.";
    if (draft.channels.length === 0) return "광고를 보여줄 곳을 하나 이상 선택해 주세요.";
  }
  return null;
}

export function campaignFromQuickDraft(draft: QuickCampaignDraft, id: string): Campaign {
  const error = getQuickDraftError(draft, 2);
  if (error) throw new Error(error);
  return {
    id,
    name: draft.name.trim(),
    channels: [...draft.channels],
    objective: draft.objective,
    industry: draft.industry,
    status: "paused",
    dailyBudget: Number(draft.budget),
    targeting: {
      ageRange: draft.age,
      gender: draft.gender,
      regions: [...new Set(draft.region.split(/[,，]/).map((region) => region.trim()).filter(Boolean))].slice(0, 10).length
        ? [...new Set(draft.region.split(/[,，]/).map((region) => region.trim()).filter(Boolean))].slice(0, 10)
        : ["전국"],
      interests: [],
      keywords: [...new Set([draft.coreKeyword.trim(), ...draft.keywords.map((keyword) => keyword.trim())].filter(Boolean))],
    },
    history: [],
  };
}

/** 명시된 업종·목표·하루 금액만 해석한다. 모델 호출 없이 입력을 정리하는 도우미다. */
export function suggestQuickSettings(description: string): Partial<QuickCampaignDraft> {
  const next: Partial<QuickCampaignDraft> = {};
  const industryRules: [RegExp, CampaignIndustry][] = [
    [/카페|식당|음식|베이커리|맛집/, "food"],
    [/미용|뷰티|네일|헤어|피부관리/, "beauty"],
    [/학원|과외|수업|교육|클래스/, "education"],
    [/병원|의원|치과|클리닉/, "medical"],
    [/쇼핑|온라인몰|쇼핑몰|의류|판매/, "shopping"],
    [/부동산|분양|중개/, "realestate"],
    [/보험|대출|금융/, "finance"],
    [/앱|소프트웨어|플랫폼|saas/i, "it_app"],
  ];
  const industry = industryRules.find(([pattern]) => pattern.test(description));
  if (industry) next.industry = industry[1];
  if (/구매|주문|매출|판매/.test(description)) next.objective = "conversion";
  else if (/문의|상담|예약/.test(description)) next.objective = "leads";
  else if (/인지도|알리고|홍보|브랜드/.test(description)) next.objective = "awareness";
  else if (/방문|유입|클릭/.test(description)) next.objective = "traffic";
  const amount = description.match(/(?:하루|일일|일\s*(?:예산|광고비))\s*(?:예산|광고비)?\s*(?:은|는|을|를|:)?\s*([0-9][0-9,.]*)\s*(만|천)?\s*원?/);
  if (amount) {
    const value = Number(amount[1].replaceAll(",", "")) * (amount[2] === "만" ? 10000 : amount[2] === "천" ? 1000 : 1);
    if (Number.isInteger(value) && value >= 1000 && value <= 100000000) next.budget = String(value);
  }
  return next;
}
