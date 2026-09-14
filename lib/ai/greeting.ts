import type { AssistantReply } from "./types";

// 크롬 Translator API가 짧은 인사말 "안녕"을 명사 "well-being(평안)"으로 오역해, 온디바이스
// 모델이 캠페인과 무관한 답(웰빙 산업 캠페인 추천 등)을 만드는 사례가 있었다. 예산·성과 질문과
// 같은 이유로, 흔한 인사말은 번역·나노를 거치지 않고 여기서 결정론적으로 바로 응답한다.
const GREETING = /^(안녕(하세요|하십니까|히)?|하이|헬로|hi|hello|반가워요?)\s*[!.~ㅎ]*$/i;

export function isPlainGreeting(text: string): boolean {
  return GREETING.test(text.trim());
}

export function greetingReply(): AssistantReply {
  return {
    reply: "안녕하세요! 캠페인 성과 확인이나 예산 조정 등 무엇이든 편하게 물어보세요.",
    actions: [],
  };
}
