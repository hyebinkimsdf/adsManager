import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import type { SiteElement, SiteScan } from "@/lib/mock/types";

// 외부 사이트에 심는 pixel.js가 크로스 오리진으로 이 엔드포인트를 호출하므로 POST는 CORS를 열어둔다.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isSiteElement(value: unknown): value is SiteElement {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.selector === "string" &&
    v.selector.length > 0 &&
    typeof v.tag === "string" &&
    typeof v.type === "string" &&
    ["form", "button", "link", "input"].includes(v.type as string) &&
    typeof v.text === "string"
  );
}

// 관리자 화면에서 "AI 자동 설정"의 입력 데이터로 쓸 최신 스캔 1건을 조회한다.
export async function GET(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  const campaignId = new URL(req.url).searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId가 필요합니다." }, { status: 400 });
  }
  try {
    const rows = await d1Query<{ id: string; campaignId: string; pageUrl: string; elements: string; scannedAt: string }>(
      "SELECT * FROM SiteScan WHERE campaignId = ? ORDER BY scannedAt DESC LIMIT 1",
      [campaignId]
    );
    if (rows.length === 0) return NextResponse.json(null);
    const row = rows[0];
    const scan: SiteScan = {
      id: row.id,
      campaignId: row.campaignId,
      pageUrl: row.pageUrl,
      elements: JSON.parse(row.elements),
      scannedAt: row.scannedAt,
    };
    return NextResponse.json(scan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// pixel.js가 사이트를 크롤링한 결과를 저장한다. 캠페인당 최신 스캔 1건만 유지한다.
export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501, headers: CORS_HEADERS });
  }

  let body: { campaignId?: string; pageUrl?: string; elements?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400, headers: CORS_HEADERS });
  }

  const elements = Array.isArray(body.elements) ? body.elements.filter(isSiteElement).slice(0, 60) : [];
  if (!body.campaignId || typeof body.campaignId !== "string" || typeof body.pageUrl !== "string" || elements.length === 0) {
    return NextResponse.json({ error: "campaignId, pageUrl, elements가 필요합니다." }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    await d1Query("DELETE FROM SiteScan WHERE campaignId = ?", [body.campaignId]);
    await d1Query(
      "INSERT INTO SiteScan (id, campaignId, pageUrl, elements, scannedAt) VALUES (?, ?, ?, ?, ?)",
      [`scan-${crypto.randomUUID()}`, body.campaignId, body.pageUrl, JSON.stringify(elements), new Date().toISOString()]
    );
    return NextResponse.json({ ok: true }, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
