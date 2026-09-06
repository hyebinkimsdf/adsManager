import { CHANNEL_LABEL, INDUSTRY_LABEL, OBJECTIVE_LABEL } from "../mock/campaigns";
import type { CampaignChannel, CampaignIndustry, CampaignObjective } from "../mock/types";

export const KEYWORD_SYSTEM_PROMPT = `당신은 광고 캠페인의 키워드 설정을 돕는 어시스턴트입니다. 캠페인의 업종, 목표, 채널, 이름을 보고 실제로 입찰할 만한 검색 키워드를 추천합니다.

규칙:
1. 반드시 주어진 JSON 스키마 형식으로만 응답합니다. 스키마 밖의 텍스트를 추가하지 마세요.
2. 업종을 가장 중요하게 반영하세요. 같은 목표라도 업종에 따라 실제 검색되는 단어는 완전히 다릅니다. 업종과 무관한 뻔한 단어(예: 업종이 병원인데 "할인")는 피하세요.
3. 키워드는 실제 사용자가 검색할 법한 자연스러운 한국어 표현으로 추천하세요.
4. 각 키워드에는 매치 타입을 지정하세요: 일반적인 단어는 broad, 구체적인 조합은 phrase, 브랜드·정확한 표현은 exact.
5. 중복되거나 캠페인 업종·목표·채널과 무관한 키워드는 넣지 마세요.
6. 사용자가 핵심 키워드를 지정하면 그 키워드를 최우선 기준으로 삼으세요. 핵심 키워드 자체(또는 그와 동급인 표현)는 tier를 core로 표시하세요.
7. sub 키워드는 핵심 키워드 뒤에 위치·가격·상담·후기·예약·비교 같은 실제 검색 의도 수식어를 붙인 조합 형태로 추천하세요 (예: 핵심 키워드가 "필라테스"면 "필라테스 위치", "필라테스 가격", "필라테스 상담"). 핵심 키워드와 막연히 주제만 겹치는 키워드보다 이런 조합형 키워드를 우선하세요.`;

export interface KeywordPromptInput {
  objective: CampaignObjective;
  channels: CampaignChannel[];
  industry: CampaignIndustry;
  name: string;
  /** 사용자가 직접 입력한 핵심 키워드. 지정되면 이를 기준으로 키워드를 확장한다. */
  coreKeyword?: string;
}

export function buildKeywordUserTurn(input: KeywordPromptInput): string {
  return `[캠페인 정보]
업종: ${INDUSTRY_LABEL[input.industry]}
목표: ${OBJECTIVE_LABEL[input.objective]}
채널: ${input.channels.map((ch) => CHANNEL_LABEL[ch]).join(", ")}
이름: ${input.name || "(아직 정하지 않음)"}
핵심 키워드: ${input.coreKeyword?.trim() || "(지정 안 함)"}

이 핵심 키워드를 중심으로 이 캠페인에 사용할 키워드를 추천해주세요. 핵심 키워드와 밀접한 키워드는 tier를 core로, 그로부터 확장된 세부 키워드는 tier를 sub로 표시해주세요.`;
}
