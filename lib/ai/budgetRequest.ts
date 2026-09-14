import type { AssistantAction, AssistantReply, CampaignSnapshot, RiskLevel } from "./types";
import { formatKRW } from "../format";
import { MIN_DAILY_BUDGET, MAX_DAILY_BUDGET, isValidDailyBudget } from "../campaigns/validate";
import { MAX_BUDGET_ADJUST_PERCENT } from "./applyAction";

const RAISE_WORD = /(늘려|올려|증액|더\s*써|확대)/;
const LOWER_WORD = /(줄여|낮춰|감액|아껴|축소)/;
const AMOUNT_TO = /([0-9][0-9,]*)\s*(만|천)?\s*원\s*(?:으로|로)/;
const PERCENT_PATTERN = /([0-9]+(?:\.[0-9]+)?)\s*%/;
const VAGUE_CHANGE = /예산.*(바꿔|변경|조정|수정)/;

const DEFAULT_ADJUST_PERCENT = 15;
const MAX_CANDIDATES = 6;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `budget-action-${counter}`;
}

function parseAmount(text: string): number | null {
  const match = text.match(AMOUNT_TO);
  if (!match) return null;
  const base = Number(match[1].replaceAll(",", ""));
  if (!Number.isFinite(base) || base <= 0) return null;
  const unit = match[2] === "만" ? 10000 : match[2] === "천" ? 1000 : 1;
  return Math.round(base * unit);
}

function parsePercentMagnitude(text: string): number | null {
  const match = text.match(PERCENT_PATTERN);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** 변경 폭에 비례한 위험도 표시 — 실제 적용 제한(MAX_BUDGET_ADJUST_PERCENT)과는 별개로 사용자에게 보여주는 신호일 뿐이다. */
function riskForChange(current: number, next: number): RiskLevel {
  if (current <= 0) return "medium";
  const changePercent = Math.abs(((next - current) / current) * 100);
  if (changePercent >= 30) return "high";
  if (changePercent >= 10) return "medium";
  return "low";
}

function findMentioned(text: string, campaigns: CampaignSnapshot[]): CampaignSnapshot | undefined {
  return campaigns.find((c) => text.includes(c.name));
}

export function isBudgetRequest(text: string): boolean {
  return RAISE_WORD.test(text) || LOWER_WORD.test(text) || AMOUNT_TO.test(text) || VAGUE_CHANGE.test(text);
}

export type BudgetRequestOutcome =
  | { kind: "not_budget_request" }
  | { kind: "clarify"; reply: AssistantReply }
  | { kind: "resolved"; reply: AssistantReply };

/**
 * 예산 변경 요청은 온디바이스/클라우드/미리보기 중 어떤 엔진이 떠 있어도 항상 같은 정확도로
 * 처리해야 하는 핵심 시연 경로라, LLM에 맡기지 않고 여기서 결정론적으로 "대상 캠페인 → 방향·금액"
 * 슬롯을 채운다. 대상이 모호할 때 캠페인을 임의로 고르지 않고 짧은 선택지로 되묻는 것이 핵심이다.
 */
export function handleBudgetRequest(
  message: string,
  campaigns: CampaignSnapshot[],
  focusedCampaignId: string | null
): BudgetRequestOutcome {
  const text = message.trim();
  if (!isBudgetRequest(text)) return { kind: "not_budget_request" };

  if (campaigns.length === 0) {
    return { kind: "resolved", reply: { reply: "아직 등록된 캠페인이 없어요. 먼저 캠페인을 만들어볼까요?", actions: [] } };
  }

  const mentioned = findMentioned(text, campaigns);
  const focused = !mentioned && focusedCampaignId ? campaigns.find((c) => c.id === focusedCampaignId) : undefined;
  const sole = !mentioned && !focused && campaigns.length === 1 ? campaigns[0] : undefined;
  const target = mentioned ?? focused ?? sole;

  if (!target) {
    const candidates = campaigns.slice(0, MAX_CANDIDATES);
    return {
      kind: "clarify",
      reply: {
        reply: "어떤 캠페인의 예산을 조정할까요? 아래에서 골라주세요.",
        actions: [],
        quickReplies: candidates.map((c) => `${c.name} ${text}`),
      },
    };
  }

  // 새 캠페인 설정 화면을 거친 캠페인은 dailyBudget이 참고용 추정치일 뿐 실제 예산이 아니라서
  // 채팅으로 조정하면 화면에 보이는 총 예산과 어긋난다. 여기서 바꾸는 대신 상세 화면으로 안내한다.
  if (target.setupStatus) {
    return {
      kind: "resolved",
      reply: { reply: `${target.name}은 아직 채팅으로 예산을 바꿀 수 없어요. 캠페인 상세 화면에서 확인해 주세요.`, actions: [] },
    };
  }

  const amount = parseAmount(text);
  if (amount !== null) {
    if (amount === target.dailyBudget) {
      return { kind: "resolved", reply: { reply: `${target.name}의 일 예산은 이미 ${formatKRW(amount)}원이에요.`, actions: [] } };
    }
    if (!isValidDailyBudget(amount)) {
      return {
        kind: "resolved",
        reply: {
          reply: `일 예산은 ${formatKRW(MIN_DAILY_BUDGET)}원~${formatKRW(MAX_DAILY_BUDGET)}원 사이로 설정할 수 있어요. 다른 금액을 말씀해 주세요.`,
          actions: [],
        },
      };
    }
    const action: AssistantAction = {
      id: nextId(),
      type: "adjust_budget",
      label: `일 예산 ${formatKRW(amount)}원으로 변경`,
      description: `${target.name}의 일 예산을 바꿔요.`,
      campaignId: target.id,
      targetAmount: amount,
      riskLevel: riskForChange(target.dailyBudget, amount),
    };
    return {
      kind: "resolved",
      reply: { reply: `${target.name}의 예산 변경안을 준비했어요. 아래에서 전후 금액을 확인하고 적용해 주세요.`, actions: [action] },
    };
  }

  const raise = RAISE_WORD.test(text);
  const lower = LOWER_WORD.test(text);
  if (raise || lower) {
    const magnitude = parsePercentMagnitude(text) ?? DEFAULT_ADJUST_PERCENT;
    if (magnitude > MAX_BUDGET_ADJUST_PERCENT) {
      return {
        kind: "resolved",
        reply: {
          reply: `예산은 한 번에 최대 ${MAX_BUDGET_ADJUST_PERCENT}%까지만 조정할 수 있어요. ${MAX_BUDGET_ADJUST_PERCENT}% 이하로 다시 말씀해 주세요.`,
          actions: [],
        },
      };
    }
    const percent = raise ? magnitude : -magnitude;
    const nextValue = Math.max(0, Math.round(target.dailyBudget * (1 + percent / 100)));
    const action: AssistantAction = {
      id: nextId(),
      type: "adjust_budget",
      label: `일 예산 ${percent > 0 ? "+" : ""}${percent}%`,
      description: `${target.name}의 일 예산을 조정해요.`,
      campaignId: target.id,
      percent,
      riskLevel: riskForChange(target.dailyBudget, nextValue),
    };
    return {
      kind: "resolved",
      reply: { reply: `${target.name}의 예산 변경안을 준비했어요. 아래에서 전후 금액을 확인하고 적용해 주세요.`, actions: [action] },
    };
  }

  // VAGUE_CHANGE만 걸린 경우(방향·금액 없이 "예산 바꿔줘" 등) — 자주 쓰는 조정 폭을 선택지로 보여준다.
  return {
    kind: "clarify",
    reply: {
      reply: `${target.name}의 예산을 얼마나 조정할까요? 정확한 금액을 말씀해도 돼요.`,
      actions: [],
      quickReplies: [
        `${target.name} 예산 10% 늘려줘`,
        `${target.name} 예산 10% 줄여줘`,
        `${target.name} 예산 20% 늘려줘`,
        `${target.name} 예산 20% 줄여줘`,
      ],
    },
  };
}
