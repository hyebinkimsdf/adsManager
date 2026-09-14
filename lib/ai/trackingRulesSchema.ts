import type { ConversionEventType } from "@/lib/mock/types";
import { EVENT_ORDER } from "@/lib/tracking/events";

// page_view는 pixel.js가 항상 자동으로 보내므로, AI가 요소에 배정할 수 있는 이벤트 종류에서는 제외한다.
export const ASSIGNABLE_EVENT_TYPES = EVENT_ORDER.filter((t) => t !== "page_view") as ConversionEventType[];

export const TRACKING_RULES_RESPONSE_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["rules"],
  properties: {
    rules: {
      type: "array",
      description: "Only include elements that represent a real conversion action. Skip anything you're not confident about.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "trigger", "eventType", "label"],
        properties: {
          index: { type: "number", description: "The index of this element in the input element list" },
          trigger: { type: "string", enum: ["click", "submit"], description: "Use submit for form elements, click for everything else" },
          eventType: { type: "string", enum: ASSIGNABLE_EVENT_TYPES },
          label: { type: "string", description: "A short English label describing what this rule tracks, e.g. 'Contact form'" },
        },
      },
    },
  },
} as const;

export interface TrackingRuleSuggestion {
  index: number;
  trigger: "click" | "submit";
  eventType: ConversionEventType;
  label: string;
}

export interface TrackingRulesReply {
  rules: TrackingRuleSuggestion[];
}

export function isTrackingRulesReply(value: unknown, elementCount: number): value is TrackingRulesReply {
  if (!value || typeof value !== "object") return false;
  const rules = (value as Record<string, unknown>).rules;
  if (!Array.isArray(rules)) return false;
  return rules.every((r) => {
    if (!r || typeof r !== "object") return false;
    const v = r as Record<string, unknown>;
    return (
      typeof v.index === "number" &&
      v.index >= 0 &&
      v.index < elementCount &&
      (v.trigger === "click" || v.trigger === "submit") &&
      typeof v.eventType === "string" &&
      ASSIGNABLE_EVENT_TYPES.includes(v.eventType as ConversionEventType) &&
      typeof v.label === "string"
    );
  });
}
