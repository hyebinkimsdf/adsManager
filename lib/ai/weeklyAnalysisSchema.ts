// Chrome Prompt API의 responseConstraint / Gemini의 responseSchema에 공통으로 쓰는 JSON Schema.
// (Gemini로 보낼 때는 additionalProperties를 제거해서 사용 — geminiClient.ts의 toGeminiSchema 참고)
export const WEEKLY_ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations", "spotlights"],
  properties: {
    recommendations: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["campaignId", "kind", "title", "detail", "percent"],
        properties: {
          campaignId: { type: "string" },
          kind: { type: "string", enum: ["lower_bid", "raise_budget", "focus_target"] },
          title: { type: "string", description: "무엇을 할지 한 문장" },
          detail: { type: "string", description: "왜 그런지 실제 수치 근거로 한 문장" },
          percent: { type: "number", description: "-30~30 사이 정수. focus_target이면 0" },
        },
      },
    },
    spotlights: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["campaignId", "tag", "reason"],
        properties: {
          campaignId: { type: "string" },
          tag: { type: "string", enum: ["best", "rising", "watch"] },
          reason: { type: "string", description: "실제 수치 근거로 한 문장" },
        },
      },
    },
  },
} as const;

export interface WeeklyAnalysisRecommendation {
  campaignId: string;
  kind: "lower_bid" | "raise_budget" | "focus_target";
  title: string;
  detail: string;
  percent: number;
}

export interface WeeklyAnalysisSpotlight {
  campaignId: string;
  tag: "best" | "rising" | "watch";
  reason: string;
}

export interface WeeklyAnalysisReply {
  recommendations: WeeklyAnalysisRecommendation[];
  spotlights: WeeklyAnalysisSpotlight[];
}
