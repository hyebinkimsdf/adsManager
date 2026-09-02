import { NextResponse } from "next/server";
import { fetchBidEstimates, isNaverSearchAdConfigured } from "@/lib/ads/naverSearchAd";

export async function POST(req: Request) {
  if (!isNaverSearchAdConfigured()) {
    return NextResponse.json({ error: "네이버 검색광고 API가 설정되지 않았습니다." }, { status: 501 });
  }

  let keywords: string[] = [];
  try {
    const body = (await req.json()) as { keywords?: string[] };
    keywords = Array.isArray(body.keywords) ? body.keywords : [];
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (keywords.length === 0) {
    return NextResponse.json({ error: "keywords가 필요합니다." }, { status: 400 });
  }

  try {
    const estimates = await fetchBidEstimates(keywords);
    return NextResponse.json({ estimates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
