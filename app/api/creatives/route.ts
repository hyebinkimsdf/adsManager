import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { toCreative, toCreativeRow, type CreativeRow } from "@/lib/creative/serialize";
import type { Creative } from "@/lib/mock/types";

export async function GET() {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    const rows = await d1Query<CreativeRow>("SELECT * FROM Creative ORDER BY createdAt DESC");
    return NextResponse.json(rows.map(toCreative));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }

  let creative: Creative;
  try {
    creative = (await req.json()) as Creative;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (!creative?.id || !creative?.campaignId || !creative?.headline) {
    return NextResponse.json({ error: "id, campaignId, headline이 필요합니다." }, { status: 400 });
  }

  try {
    const row = toCreativeRow(creative);
    await d1Query(
      `INSERT INTO Creative (id, campaignId, campaignName, headline, body, imageWidth, imageHeight, landingUrl, precheckScore, precheckItems, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.campaignId,
        row.campaignName,
        row.headline,
        row.body,
        row.imageWidth,
        row.imageHeight,
        row.landingUrl,
        row.precheckScore,
        row.precheckItems,
        row.createdAt,
      ]
    );
    return NextResponse.json(creative, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
