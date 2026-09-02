import { adjustBudgetByPercent, addKeywords, adjustKeywordBidsByPercent, setStatus } from "../mock/store";
import type { AssistantAction } from "./types";

export function applyAction(action: AssistantAction) {
  if (!action.campaignId) return;
  switch (action.type) {
    case "adjust_budget":
      adjustBudgetByPercent(action.campaignId, action.percent ?? 0);
      break;
    case "pause_campaign":
      setStatus(action.campaignId, "paused");
      break;
    case "resume_campaign":
      setStatus(action.campaignId, "active");
      break;
    case "add_keywords":
      addKeywords(action.campaignId, action.keywords ?? []);
      break;
    case "adjust_keyword_bids":
      adjustKeywordBidsByPercent(action.campaignId, action.percent ?? 0);
      break;
    default:
      break;
  }
}
