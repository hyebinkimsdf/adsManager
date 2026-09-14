import type { CampaignIndustry, DisplayObjective } from "@/lib/mock/types";
import { INDUSTRIES, OBJECTIVES, type ValidationResult } from "@/lib/campaigns/validate";

export const MIN_TOTAL_BUDGET = 100_000;
export const TOTAL_BUDGET_STEP = 100;

export interface CampaignSetupDraft {
  requestId: string;
  name: string;
  totalBudget: number;
  startDate: string;
  endDate: string | null;
  trackingConnectionId: string | null;
  objective: DisplayObjective;
  industry: CampaignIndustry;
}

export interface CampaignSetupRequest extends CampaignSetupDraft {
  saveAsDraft: boolean;
}

export interface TrackingConnectionOption {
  id: string;
  name: string;
  siteUrl: string;
}

export interface CampaignSetupOptions {
  trackingConnections: TrackingConnectionOption[];
  budgetRecommendation: {
    totalBudget: number | null;
    /** benchmark: 실계정 실적 집계. static: 목표·업종별 일반 기준표. unavailable: 둘 다 못 쓸 때(기간 미정 등). */
    source: "benchmark" | "static" | "unavailable";
    reason: string;
  };
}

/** 완결성 체크에서 "기간이 너무 짧다"고 보는 기준 — 데이터가 의미 있게 쌓이려면 보통 이 정도는 필요하다. */
export const MIN_RECOMMENDED_DAYS = 7;

export function planDays(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
}

// 실계정 벤치마크(getCampaignSetupOptions)를 못 쓸 때도 "일단 10만원"보다 나은 근거를 주기 위한
// 목표·업종별 일반 기준표. 실제 성과를 보장하지 않는 대략적인 시작점일 뿐이다.
const OBJECTIVE_DAILY_BUDGET: Record<DisplayObjective, number> = {
  visit: 30_000,
  leads: 50_000,
  purchase: 70_000,
  reach: 90_000,
  app_install: 100_000,
};

const INDUSTRY_BUDGET_MULTIPLIER: Record<CampaignIndustry, number> = {
  food: 0.8,
  beauty: 0.9,
  education: 1.05,
  medical: 1.3,
  shopping: 1,
  realestate: 1.2,
  finance: 1.4,
  it_app: 1.15,
  etc: 1,
};

export function staticBudgetRecommendation(objective: DisplayObjective, industry: CampaignIndustry, days: number): number {
  const daily = OBJECTIVE_DAILY_BUDGET[objective] * INDUSTRY_BUDGET_MULTIPLIER[industry];
  return Math.max(MIN_TOTAL_BUDGET, Math.round((daily * days) / 100) * 100);
}

export function koreaDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function defaultCampaignName(now = new Date()): string {
  const stamp = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return `캠페인_${stamp.slice(0, 10).replaceAll("-", "")}_${stamp.slice(11, 19).replaceAll(":", "")}`;
}

export function isSetupDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function createCampaignSetupDraft(now = new Date(), requestId = crypto.randomUUID()): CampaignSetupDraft {
  const startDate = koreaDate(now);
  const endDate = new Date(new Date(`${startDate}T00:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  return {
    requestId, name: "", totalBudget: MIN_TOTAL_BUDGET, startDate, endDate,
    trackingConnectionId: null, objective: "purchase", industry: "etc",
  };
}

export function validateCampaignSetup(value: unknown): ValidationResult<CampaignSetupRequest> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "광고 설정을 확인해 주세요." };
  const v = value as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(v.requestId)) return { ok: false, error: "화면을 다시 열고 저장해 주세요." };
  if (typeof v.name !== "string" || v.name.trim().length > 100) return { ok: false, error: "광고 이름은 100자까지 쓸 수 있어요." };
  if (typeof v.totalBudget !== "number" || !Number.isSafeInteger(v.totalBudget) || v.totalBudget < MIN_TOTAL_BUDGET || v.totalBudget % TOTAL_BUDGET_STEP !== 0) {
    return { ok: false, error: "총 예산은 100,000원 이상, 100원 단위로 입력해 주세요." };
  }
  if (!isSetupDate(v.startDate) || (v.endDate !== null && !isSetupDate(v.endDate))) return { ok: false, error: "시작일과 종료일을 확인해 주세요." };
  if (typeof v.endDate === "string" && v.endDate < v.startDate) return { ok: false, error: "종료일은 시작일보다 빠를 수 없어요." };
  if (v.trackingConnectionId !== null && (typeof v.trackingConnectionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v.trackingConnectionId))) return { ok: false, error: "연결할 코드를 다시 골라 주세요." };
  if (typeof v.objective !== "string" || !OBJECTIVES.includes(v.objective as DisplayObjective)) return { ok: false, error: "광고 목표를 골라 주세요." };
  if (typeof v.industry !== "string" || !INDUSTRIES.includes(v.industry as CampaignIndustry)) return { ok: false, error: "업종을 골라 주세요." };
  if (typeof v.saveAsDraft !== "boolean") return { ok: false, error: "저장 방법을 확인해 주세요." };
  if (!v.saveAsDraft && !v.trackingConnectionId) return { ok: false, error: "연결된 코드가 없어요. 먼저 초안으로 저장해 주세요." };
  return { ok: true, value: {
    requestId: v.requestId, name: v.name.trim(), totalBudget: v.totalBudget,
    startDate: v.startDate, endDate: v.endDate as string | null,
    trackingConnectionId: v.trackingConnectionId as string | null,
    objective: v.objective as DisplayObjective, industry: v.industry as CampaignIndustry,
    saveAsDraft: v.saveAsDraft,
  } };
}
