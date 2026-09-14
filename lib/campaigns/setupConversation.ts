import type { CampaignSetupDraft } from "./setup";
import { createCampaignSetupDraft, isSetupDate } from "./setup";
import { guessIndustryFromText, guessObjectiveFromText } from "@/lib/ai/campaignDraftHeuristics";

export function isSetupRequest(message: string): boolean {
  if (/(만들지|생성하지|세팅하지|셋팅하지|시작하지|취소|기존)/.test(message)) return false;
  return /(광고|캠페인).*(만들|생성|세팅|셋팅|설정해|시작|새로)|(새로운?|신규).*(광고|캠페인)|(홍보|광고).*(하고 싶|해보고 싶|해볼까)/.test(message);
}

export function isSetupEdit(message: string): boolean {
  return /(예산|금액|종료일|시작일|기간|이름|캠페인명|목표|업종|구매|문의|방문|설치|도달|쇼핑몰|카페|학원|병원|연결)|^\s*-?[\d,.]+\s*(?:만|천)?\s*원|\d+\s*(?:일|주)(?:간|동안)/.test(message);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
}

export function newSetupDraft(now = new Date()): CampaignSetupDraft {
  return createCampaignSetupDraft(now);
}

export interface SetupEditResult {
  draft: CampaignSetupDraft;
  note: string;
  /** 이번 메시지에서 실제로 읽어낸 필드 — 못 읽은 필드는 이전 값(또는 기본값)이 그대로 남는다는 뜻. */
  matched: { objective: boolean; industry: boolean; budget: boolean };
}

/** 인식한 필드만 바꾼다. 금액을 몰래 올리거나 하루 예산을 총 예산으로 해석하지 않는다. */
export function editSetupFromMessage(draft: CampaignSetupDraft, message: string): SetupEditResult {
  const next = { ...draft };
  const notes: string[] = [];
  const objective = guessObjectiveFromText(message);
  const industry = guessIndustryFromText(message);
  if (objective) next.objective = objective;
  if (industry) next.industry = industry;
  const budget = message.match(/(?:총\s*)?(?:예산|금액|광고비)(?:만|은|는|을|를)?\s*(?:총|전체)?\s*(-?[\d,]+(?:\.\d+)?)\s*(만|천)?\s*원?/)
    ?? message.match(/(-?[\d,]+(?:\.\d+)?)\s*(만|천)?\s*원(?:\s*(?:으로|정도))?/);
  let matchedBudget = false;
  if (budget) {
    if (/(하루|일일|일\s*예산)/.test(message)) notes.push("하루 예산이 아닌, 전체 기간에 쓸 금액을 알려주세요.");
    else { next.totalBudget = Number(budget[1].replaceAll(",", "")) * (budget[2] === "만" ? 10000 : budget[2] === "천" ? 1000 : 1); matchedBudget = true; }
  }
  const start = message.match(/(?:시작일|시작)\s*(?:은|는|:)?\s*(\d{4}-\d{2}-\d{2})/);
  const end = message.match(/(?:종료일|종료)\s*(?:은|는|:)?\s*(\d{4}-\d{2}-\d{2})/);
  if (start) next.startDate = start[1];
  const withoutEnd = /(종료일|끝나는 날|종료 날짜).*(없|없이)|무기한/.test(message);
  if (withoutEnd) next.endDate = null;
  const days = message.match(/(\d+)\s*(일|주)(?:간|동안|로|으로)/);
  if (days && !withoutEnd) {
    const length = Number(days[1]) * (days[2] === "주" ? 7 : 1);
    if (length >= 1 && length <= 366 && isSetupDate(next.startDate)) next.endDate = addDays(next.startDate, length - 1);
    else notes.push("기간은 카드에서 확인해 주세요.");
  }
  if (end) next.endDate = end[1];
  const name = message.match(/(?:캠페인명|이름)(?:은|는|을|를)?\s*["“']([^"”']+)["”']/)
    ?? message.match(/(?:캠페인명|이름)(?:은|는|을|를)?\s+(.+?)(?:으로|로)(?:\s*(?:해줘|바꿔줘|변경해줘))?[.!?]?$/);
  if (name) next.name = name[1].trim();
  if (/(이름|캠페인명).*(자동|없|비워)/.test(message)) next.name = "";
  if (/연결/.test(message)) notes.push("연결할 코드는 카드에서 골라주세요.");
  return {
    draft: next,
    note: notes.join(" ") || "카드에 반영했어요. 확인하고 저장해 주세요.",
    matched: { objective: Boolean(objective), industry: Boolean(industry), budget: matchedBudget },
  };
}
