// Chrome Prompt API의 responseConstraint에 그대로 전달하는 JSON Schema.
// 모델이 이 형태를 벗어난 텍스트(마크다운, 설명 등)를 섞지 않도록 강제한다.
export const ASSISTANT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "actions"],
  properties: {
    reply: {
      type: "string",
      description: "사용자에게 보여줄 한국어 답변. 2~3문장, 친절하고 간결한 톤.",
    },
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "label", "description", "riskLevel"],
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "adjust_budget",
              "pause_campaign",
              "resume_campaign",
              "open_keyword_tool",
              "info",
            ],
          },
          label: { type: "string", description: "버튼에 들어갈 짧은 액션 이름" },
          description: { type: "string", description: "이 액션이 무엇을 바꾸는지 한 문장 설명" },
          campaignId: { type: "string" },
          percent: { type: "number" },
          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
} as const;

// 크롬 온디바이스 Prompt API의 영어 우회 경로용 — enum 등 구조는 ASSISTANT_RESPONSE_SCHEMA와 동일하고,
// 모델이 실제로 생성하는 자연어(reply/label/description)만 영어로 유도한다.
export const ASSISTANT_RESPONSE_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "actions"],
  properties: {
    reply: {
      type: "string",
      description: "Reply to show the user, in English. 2-3 sentences, friendly and concise.",
    },
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "label", "description", "riskLevel"],
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "adjust_budget",
              "pause_campaign",
              "resume_campaign",
              "open_keyword_tool",
              "info",
            ],
          },
          label: { type: "string", description: "Short action name for the button, in English" },
          description: { type: "string", description: "One English sentence describing what this action changes" },
          campaignId: { type: "string" },
          percent: { type: "number" },
          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
} as const;
