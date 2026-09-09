import { NextResponse } from "next/server";
import { generateTrackingRules, isGeminiConfigured } from "@/lib/ai/geminiClient";
import type { SiteElement } from "@/lib/mock/types";

export async function POST(req: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "Gemini API가 설정되지 않았습니다." }, { status: 501 });
  }

  let elements: SiteElement[] = [];
  try {
    const body = (await req.json()) as { elements?: SiteElement[] };
    elements = Array.isArray(body.elements) ? body.elements : [];
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (elements.length === 0) {
    return NextResponse.json({ error: "elements가 필요합니다." }, { status: 400 });
  }

  try {
    const reply = await generateTrackingRules(elements);
    if (!reply) {
      return NextResponse.json({ error: "Gemini 응답을 파싱하지 못했습니다." }, { status: 502 });
    }
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
