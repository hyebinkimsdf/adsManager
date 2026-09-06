// Chrome Prompt API의 responseConstraint에 그대로 전달하는 JSON Schema.
export const KEYWORD_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["keywords"],
  properties: {
    keywords: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keyword", "matchType", "tier"],
        properties: {
          keyword: { type: "string", description: "실제 사용자가 검색할 법한 한국어 키워드" },
          matchType: {
            type: "string",
            enum: ["broad", "phrase", "exact"],
            description: "broad: 폭넓은 일반 단어, phrase: 구체적인 조합, exact: 브랜드/정확한 표현",
          },
          tier: {
            type: "string",
            enum: ["core", "sub"],
            description: "core: 사용자가 지정한 핵심 키워드와 밀접한 주요 키워드, sub: 핵심 키워드에서 확장된 세부/롱테일 키워드",
          },
        },
      },
    },
  },
} as const;
