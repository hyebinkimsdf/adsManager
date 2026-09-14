import type { AdType, Campaign, CampaignIndustry, CampaignStatus, DayMetric, DisplayObjective, Targeting } from "@/lib/mock/types";

export const AD_TYPES: AdType[] = ["display", "reward"];
export const OBJECTIVES: DisplayObjective[] = ["purchase", "app_install", "leads", "visit", "reach"];
export const INDUSTRIES: CampaignIndustry[] = [
  "food",
  "beauty",
  "education",
  "medical",
  "shopping",
  "realestate",
  "finance",
  "it_app",
  "etc",
];
export const STATUSES: CampaignStatus[] = ["active", "paused"];
export const GENDERS: Targeting["gender"][] = ["all", "male", "female"];

export const MIN_DAILY_BUDGET = 1_000;
export const MAX_DAILY_BUDGET = 10_000_000;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isStringArray(value: unknown, maxItems: number, maxItemLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= maxItemLength)
  );
}

export function isValidDailyBudget(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_DAILY_BUDGET &&
    value <= MAX_DAILY_BUDGET
  );
}

export function validateTargeting(value: unknown): ValidationResult<Targeting> {
  if (!value || typeof value !== "object") return { ok: false, error: "targeting 객체가 필요합니다." };
  const v = value as Record<string, unknown>;
  if (!isNonEmptyString(v.ageRange, 20)) return { ok: false, error: "targeting.ageRange가 올바르지 않습니다." };
  if (typeof v.gender !== "string" || !GENDERS.includes(v.gender as Targeting["gender"])) {
    return { ok: false, error: `targeting.gender는 ${GENDERS.join("/")} 중 하나여야 합니다.` };
  }
  if (!isStringArray(v.regions, 50, 50)) return { ok: false, error: "targeting.regions는 문자열 배열(최대 50개)이어야 합니다." };
  if (!isStringArray(v.interests, 50, 50)) return { ok: false, error: "targeting.interests는 문자열 배열(최대 50개)이어야 합니다." };
  return {
    ok: true,
    value: { ageRange: v.ageRange as string, gender: v.gender as Targeting["gender"], regions: v.regions as string[], interests: v.interests as string[] },
  };
}

function isValidDayMetric(value: unknown): value is DayMetric {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const numericFieldsValid = (["spend", "impressions", "clicks", "conversions", "revenue"] as const).every(
    (key) => typeof v[key] === "number" && Number.isFinite(v[key]) && (v[key] as number) >= 0
  );
  return typeof v.label === "string" && numericFieldsValid && (v.date === undefined || typeof v.date === "string");
}

export function validateHistory(value: unknown): ValidationResult<DayMetric[]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value) || value.length > 400 || !value.every(isValidDayMetric)) {
    return { ok: false, error: "history는 유효한 일자별 지표 배열이어야 합니다." };
  }
  return { ok: true, value: value as DayMetric[] };
}

export function validateCampaignCreate(value: unknown): ValidationResult<Campaign> {
  if (!value || typeof value !== "object") return { ok: false, error: "요청 본문이 필요합니다." };
  const v = value as Record<string, unknown>;

  if (!isNonEmptyString(v.id, 128) || !/^[A-Za-z0-9_-]+$/.test(v.id)) {
    return { ok: false, error: "id는 영문/숫자/-/_ 로 구성된 128자 이내 문자열이어야 합니다." };
  }
  if (!isNonEmptyString(v.name, 100)) return { ok: false, error: "name은 1~100자여야 합니다." };
  if (typeof v.adType !== "string" || !AD_TYPES.includes(v.adType as AdType)) {
    return { ok: false, error: `adType은 ${AD_TYPES.join("/")} 중 하나여야 합니다.` };
  }
  if (typeof v.objective !== "string" || !OBJECTIVES.includes(v.objective as DisplayObjective)) {
    return { ok: false, error: `objective는 ${OBJECTIVES.join("/")} 중 하나여야 합니다.` };
  }
  if (typeof v.industry !== "string" || !INDUSTRIES.includes(v.industry as CampaignIndustry)) {
    return { ok: false, error: `industry는 ${INDUSTRIES.join("/")} 중 하나여야 합니다.` };
  }
  if (typeof v.status !== "string" || !STATUSES.includes(v.status as CampaignStatus)) {
    return { ok: false, error: `status는 ${STATUSES.join("/")} 중 하나여야 합니다.` };
  }
  if (!isValidDailyBudget(v.dailyBudget)) {
    return { ok: false, error: `dailyBudget은 ${MIN_DAILY_BUDGET}~${MAX_DAILY_BUDGET} 사이의 정수여야 합니다.` };
  }
  const targeting = validateTargeting(v.targeting);
  if (!targeting.ok) return targeting;
  const history = validateHistory(v.history);
  if (!history.ok) return history;

  return {
    ok: true,
    value: {
      id: v.id,
      name: (v.name as string).trim(),
      adType: v.adType as AdType,
      objective: v.objective as DisplayObjective,
      industry: v.industry as CampaignIndustry,
      status: v.status as CampaignStatus,
      dailyBudget: v.dailyBudget as number,
      targeting: targeting.value,
      history: history.value,
    },
  };
}

export function validateCampaignPatch(value: unknown): ValidationResult<Partial<Campaign>> {
  if (!value || typeof value !== "object") return { ok: false, error: "요청 본문이 필요합니다." };
  const v = value as Record<string, unknown>;
  const patch: Partial<Campaign> = {};

  if (v.name !== undefined) {
    if (!isNonEmptyString(v.name, 100)) return { ok: false, error: "name은 1~100자여야 합니다." };
    patch.name = v.name.trim();
  }
  if (v.adType !== undefined) {
    if (typeof v.adType !== "string" || !AD_TYPES.includes(v.adType as AdType)) {
      return { ok: false, error: `adType은 ${AD_TYPES.join("/")} 중 하나여야 합니다.` };
    }
    patch.adType = v.adType as AdType;
  }
  if (v.objective !== undefined) {
    if (typeof v.objective !== "string" || !OBJECTIVES.includes(v.objective as DisplayObjective)) {
      return { ok: false, error: `objective는 ${OBJECTIVES.join("/")} 중 하나여야 합니다.` };
    }
    patch.objective = v.objective as DisplayObjective;
  }
  if (v.industry !== undefined) {
    if (typeof v.industry !== "string" || !INDUSTRIES.includes(v.industry as CampaignIndustry)) {
      return { ok: false, error: `industry는 ${INDUSTRIES.join("/")} 중 하나여야 합니다.` };
    }
    patch.industry = v.industry as CampaignIndustry;
  }
  if (v.status !== undefined) {
    if (typeof v.status !== "string" || !STATUSES.includes(v.status as CampaignStatus)) {
      return { ok: false, error: `status는 ${STATUSES.join("/")} 중 하나여야 합니다.` };
    }
    patch.status = v.status as CampaignStatus;
  }
  if (v.dailyBudget !== undefined) {
    if (!isValidDailyBudget(v.dailyBudget)) {
      return { ok: false, error: `dailyBudget은 ${MIN_DAILY_BUDGET}~${MAX_DAILY_BUDGET} 사이의 정수여야 합니다.` };
    }
    patch.dailyBudget = v.dailyBudget;
  }
  if (v.targeting !== undefined) {
    const targeting = validateTargeting(v.targeting);
    if (!targeting.ok) return targeting;
    patch.targeting = targeting.value;
  }
  if (v.history !== undefined) {
    const history = validateHistory(v.history);
    if (!history.ok) return history;
    patch.history = history.value;
  }

  return { ok: true, value: patch };
}
