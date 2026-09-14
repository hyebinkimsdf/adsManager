import type { ChatTurn } from "./types";

export interface ConversationMessage { role: "user" | "assistant"; text: string; }

/** 화면에 실제 표시한 답변(규칙 기반 포함)만 모델에 전달한다. */
export function recentConversation(turns: ChatTurn[]): ConversationMessage[] {
  return turns.filter(turn => !turn.pending && (turn.text || turn.reply?.reply)).slice(-8).map(turn => ({
    role: turn.role,
    text: (turn.role === "user" ? turn.text ?? "" : [turn.reply?.reply ?? "", ...(turn.reply?.actions.map(a => `${a.label}: ${a.description}`) ?? [])].join("\n")).slice(0, 800),
  }));
}

export function waitingCorrection(message: string, history: ConversationMessage[]): string | null {
  if (!/(기다리|기다려|기다림|잠시|잠깐|처리.*(?:라며|한다|중)|언제.*답)/.test(message)) return null;
  const previous = [...history].reverse().find(turn => turn.role === "assistant");
  if (!previous) return null;
  if (/(기다|잠시|잠깐|처리.*중|분석.*중)/.test(previous.text)) {
    return "제가 기다려 달라고 잘못 안내했어요. 지금 진행 중인 추가 작업은 없어요. 확인할 내용을 말씀해 주시면 이번 답변에서 알려드릴게요.";
  }
  return "지금 진행 중인 추가 작업은 없어요. 확인할 내용을 말씀해 주세요.";
}
