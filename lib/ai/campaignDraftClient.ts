import type { CampaignDraftSuggestion } from "./campaignDraftSchema";

export async function fetchCampaignDraft(description: string): Promise<CampaignDraftSuggestion | null> {
  try {
    const res = await fetch("/api/ai/campaign-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { draft?: CampaignDraftSuggestion };
    return data.draft ?? null;
  } catch {
    return null;
  }
}
