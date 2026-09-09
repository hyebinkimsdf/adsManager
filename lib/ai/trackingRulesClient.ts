import type { SiteElement } from "@/lib/mock/types";
import type { TrackingRulesReply } from "./trackingRulesSchema";

export async function fetchTrackingRules(elements: SiteElement[]): Promise<TrackingRulesReply | null> {
  try {
    const res = await fetch("/api/ai/tracking-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ elements }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { reply?: TrackingRulesReply };
    return data.reply ?? null;
  } catch {
    return null;
  }
}
