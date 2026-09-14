// Chrome Prompt API의 responseConstraint에 그대로 전달하는 JSON Schema.
// 모델이 이 형태를 벗어난 텍스트(마크다운, 설명 등)를 섞지 않도록 강제한다.
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
            enum: ["adjust_budget", "pause_campaign", "resume_campaign", "info"],
          },
          label: { type: "string", description: "Short action name for the button, in English" },
          description: { type: "string", description: "One English sentence describing what this action changes" },
          campaignId: { type: "string" },
          percent: { type: "number" },
          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    quickReplies: {
      type: "array",
      maxItems: 3,
      items: { type: "string" },
      description:
        "Only when the request is ambiguous and reply is asking a clarifying question: up to 3 short, concrete guesses of what the user might mean, each phrased as a full message the user could tap to send as-is, in English. Leave empty otherwise.",
    },
  },
} as const;
