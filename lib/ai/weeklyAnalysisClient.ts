import type { WeeklyCampaignInput } from "./weeklyAnalysisPrompt";
import type { WeeklyAnalysisReply } from "./weeklyAnalysisSchema";

export async function fetchWeeklyAnalysisReply(campaigns: WeeklyCampaignInput[]): Promise<WeeklyAnalysisReply | null> {
  try {
    const res = await fetch("/api/ai/weekly-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaigns }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { reply?: WeeklyAnalysisReply };
    return data.reply ?? null;
  } catch {
    return null;
  }
}
