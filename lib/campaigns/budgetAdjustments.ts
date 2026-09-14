import { randomUUID } from "node:crypto";
import { d1Query } from "@/lib/d1";
import { sumHistory } from "@/lib/mock/campaigns";
import { verifiedHistorySince } from "@/lib/campaignMetrics";
import { formatSignedPercent } from "@/lib/format";
import type { Campaign } from "@/lib/mock/types";

type Query = typeof d1Query;

export interface BudgetAdjustmentRow {
  id: string;
  campaignId: string;
  ownerId: string;
  source: "recommendation" | "manual";
  reasonKind: "lower_budget" | "raise_budget" | null;
  previousBudget: number;
  newBudget: number;
  percent: number | null;
  baselineSpend: number;
  baselineConversions: number;
  baselineRoas: number;
  createdAt: string;
}

export interface RecordBudgetAdjustmentInput {
  campaignId: string;
  ownerId: string;
  source: "recommendation" | "manual";
  reasonKind: "lower_budget" | "raise_budget" | null;
  previousBudget: number;
  newBudget: number;
  /** 최근 7일 실적 — 변경 "직전" 캠페인의 history에서 계산해 넘긴다(이 함수는 재계산하지 않는다). */
  baseline: { spend: number; conversions: number; roas: number };
}

/**
 * dailyBudget이 바뀔 때마다 이력 한 줄을 남긴다. 감사 로그는 부가 기능이라 실패해도 예산 변경 자체를
 * 실패로 만들지 않는다 — 호출부(PATCH 라우트)가 best-effort로 감싸 쓴다.
 */
export async function recordBudgetAdjustment(input: RecordBudgetAdjustmentInput, query: Query = d1Query): Promise<void> {
  await query(
    `INSERT INTO BudgetAdjustment (
       id, campaignId, ownerId, source, reasonKind, previousBudget, newBudget, percent,
       baselineSpend, baselineConversions, baselineRoas
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.campaignId,
      input.ownerId,
      input.source,
      input.reasonKind,
      input.previousBudget,
      input.newBudget,
      input.previousBudget > 0 ? ((input.newBudget - input.previousBudget) / input.previousBudget) * 100 : null,
      input.baseline.spend,
      input.baseline.conversions,
      input.baseline.roas,
    ]
  );
}

export async function listBudgetAdjustments(campaignId: string, ownerId: string, query: Query = d1Query, limit = 20): Promise<BudgetAdjustmentRow[]> {
  return query<BudgetAdjustmentRow>(
    "SELECT * FROM BudgetAdjustment WHERE campaignId = ? AND ownerId = ? ORDER BY createdAt DESC LIMIT ?",
    [campaignId, ownerId, limit]
  );
}

const EFFECT_MIN_LIVE_DAYS = 3;

export interface AdjustmentEffect {
  status: "pending" | "ready" | "unavailable";
  newDataDays: number;
  minDays: number;
  message: string;
  current?: { spend: number; conversions: number; roas: number };
  deltaPct?: { spend: number; conversions: number; roas: number };
  verdict?: "improved" | "worsened" | "flat";
}

function pctDelta(before: number, after: number): number {
  if (before === 0) return after > 0 ? 100 : 0;
  return ((after - before) / before) * 100;
}

/**
 * 이 조정 "이후" ~ 다음 조정(있다면) 또는 지금까지 쌓인 실데이터로 효과를 비교한다. until을 주는 이유는
 * 캠페인 하나에 조정이 여러 번 있을 때, 뒤 조정 이후 쌓인 데이터가 앞 조정의 효과로 잘못 섞이지 않게
 * 막기 위해서다.
 */
export function computeAdjustmentEffect(campaign: Campaign, adjustment: BudgetAdjustmentRow, until?: string): AdjustmentEffect {
  const baseline = { spend: adjustment.baselineSpend, conversions: adjustment.baselineConversions, roas: adjustment.baselineRoas };
  if (campaign.metricSource !== "live") {
    return {
      status: "unavailable",
      newDataDays: 0,
      minDays: EFFECT_MIN_LIVE_DAYS,
      message: "아직 실제 매체 데이터가 연결되지 않아 효과를 판단할 수 없어요.",
    };
  }
  const newDays = verifiedHistorySince(campaign, adjustment.createdAt, until);
  if (newDays.length < EFFECT_MIN_LIVE_DAYS) {
    return {
      status: "pending",
      newDataDays: newDays.length,
      minDays: EFFECT_MIN_LIVE_DAYS,
      message: `새 데이터가 ${newDays.length}/${EFFECT_MIN_LIVE_DAYS}일 쌓였어요. 조금 더 지켜봐야 판단할 수 있어요.`,
    };
  }
  const totals = sumHistory(newDays);
  const current = { spend: totals.spend, conversions: totals.conversions, roas: totals.roas };
  const deltaPct = {
    spend: pctDelta(baseline.spend, current.spend),
    conversions: pctDelta(baseline.conversions, current.conversions),
    roas: pctDelta(baseline.roas, current.roas),
  };
  const verdict: AdjustmentEffect["verdict"] = deltaPct.roas > 5 ? "improved" : deltaPct.roas < -5 ? "worsened" : "flat";
  const message =
    verdict === "improved"
      ? `조정 이후 ROAS가 ${formatSignedPercent(deltaPct.roas, 0)} 개선됐어요.`
      : verdict === "worsened"
      ? `조정 이후 ROAS가 ${formatSignedPercent(deltaPct.roas, 0)} 낮아졌어요.`
      : "조정 이후 큰 변화는 없었어요.";
  return { status: "ready", newDataDays: newDays.length, minDays: EFFECT_MIN_LIVE_DAYS, message, current, deltaPct, verdict };
}
