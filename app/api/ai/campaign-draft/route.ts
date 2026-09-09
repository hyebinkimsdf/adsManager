import { NextResponse } from "next/server";
import { generateCampaignDraft, isGeminiConfigured } from "@/lib/ai/geminiClient";

export async function POST(req: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "Gemini API가 설정되지 않았습니다." }, { status: 501 });
  }

  let description = "";
  try {
    const body = (await req.json()) as { description?: string };
    description = typeof body.description === "string" ? body.description : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!description.trim()) {
    return NextResponse.json({ error: "description이 필요합니다." }, { status: 400 });
  }

  try {
    const draft = await generateCampaignDraft(description);
    if (!draft) {
      return NextResponse.json({ error: "Gemini 응답을 파싱하지 못했습니다." }, { status: 502 });
    }
    return NextResponse.json({ draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
