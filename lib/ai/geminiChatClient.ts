import type { AssistantReply, CampaignSnapshot } from "./types";

export async function fetchGeminiReply(
  message: string,
  campaigns: CampaignSnapshot[]
): Promise<AssistantReply | null> {
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, campaigns }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { reply?: AssistantReply };
    return data.reply ?? null;
  } catch {
    return null;
  }
}
