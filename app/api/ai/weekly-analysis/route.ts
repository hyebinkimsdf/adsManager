import { NextResponse } from "next/server";
import { generateWeeklyAnalysisReply, isGeminiConfigured } from "@/lib/ai/geminiClient";
import type { WeeklyCampaignInput } from "@/lib/ai/weeklyAnalysisPrompt";

export async function POST(req: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "Gemini API가 설정되지 않았습니다." }, { status: 501 });
  }

  let campaigns: WeeklyCampaignInput[] = [];
  try {
    const body = (await req.json()) as { campaigns?: WeeklyCampaignInput[] };
    campaigns = Array.isArray(body.campaigns) ? body.campaigns : [];
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (campaigns.length === 0) {
    return NextResponse.json({ error: "campaigns가 필요합니다." }, { status: 400 });
  }

  try {
    const reply = await generateWeeklyAnalysisReply(campaigns);
    if (!reply) {
      return NextResponse.json({ error: "Gemini 응답을 파싱하지 못했습니다." }, { status: 502 });
    }
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
