import { adjustBudgetByPercent, setStatus, updateBudget } from "../mock/store";
import { isValidDailyBudget, MIN_DAILY_BUDGET, MAX_DAILY_BUDGET } from "../campaigns/validate";
import { formatKRW } from "../format";
import type { AssistantAction } from "./types";

// 프롬프트에도 같은 상한을 안내하지만, 모델 출력만 믿지 않고 실행 직전에 한 번 더 막는다.
export const MAX_BUDGET_ADJUST_PERCENT = 30;

/** "info" 액션은 설명만 있고 실행할 변경이 없다 — 카드에 적용 버튼을 그리기 전에 걸러낸다. */
export function isApplicableAction(action: AssistantAction): boolean {
  return action.type !== "info" && Boolean(action.campaignId);
}

export async function applyAction(action: AssistantAction): Promise<void> {
  if (!action.campaignId) throw new Error("적용할 캠페인이 지정되지 않았어요.");
  switch (action.type) {
    case "adjust_budget": {
      if (action.targetAmount !== undefined) {
        if (!isValidDailyBudget(action.targetAmount)) {
          throw new Error(`일 예산은 ${formatKRW(MIN_DAILY_BUDGET)}원~${formatKRW(MAX_DAILY_BUDGET)}원 사이여야 해요.`);
        }
        await updateBudget(action.campaignId, action.targetAmount);
        return;
      }
      const percent = action.percent ?? 0;
      if (!Number.isFinite(percent) || Math.abs(percent) > MAX_BUDGET_ADJUST_PERCENT) {
        throw new Error(`예산은 한 번에 최대 ${MAX_BUDGET_ADJUST_PERCENT}%까지만 조정할 수 있어요.`);
      }
      await adjustBudgetByPercent(action.campaignId, percent);
      return;
    }
    case "pause_campaign":
      await setStatus(action.campaignId, "paused");
      return;
    case "resume_campaign":
      await setStatus(action.campaignId, "active");
      return;
    default:
      throw new Error("이 액션은 직접 적용할 수 없어요.");
  }
}
