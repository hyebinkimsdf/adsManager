import { NextResponse } from "next/server";
import { fetchPositionEstimate, isNaverSearchAdConfigured } from "@/lib/ads/naverSearchAd";

export async function POST(req: Request) {
  if (!isNaverSearchAdConfigured()) {
    return NextResponse.json({ error: "네이버 검색광고 API가 설정되지 않았습니다." }, { status: 501 });
  }

  let keyword = "";
  let position = 0;
  try {
    const body = (await req.json()) as { keyword?: string; position?: number };
    keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
    position = typeof body.position === "number" ? body.position : 0;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!keyword || !Number.isInteger(position) || position < 1) {
    return NextResponse.json({ error: "keyword와 1 이상의 정수 position이 필요합니다." }, { status: 400 });
  }

  try {
    const estimate = await fetchPositionEstimate(keyword, position);
    if (!estimate) {
      return NextResponse.json({ error: "해당 순위의 입찰가를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ keyword, position, ...estimate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
