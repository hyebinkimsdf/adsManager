import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { toAudience, toAudienceRow, type AudienceRow } from "@/lib/audiences/serialize";
import type { Audience } from "@/lib/mock/types";

export async function GET() {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    const rows = await d1Query<AudienceRow>("SELECT * FROM Audience ORDER BY createdAt DESC");
    return NextResponse.json(rows.map(toAudience));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }

  let audience: Audience;
  try {
    audience = (await req.json()) as Audience;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!audience?.id || !audience?.name || !audience?.type) {
    return NextResponse.json({ error: "id, name, type이 필요합니다." }, { status: 400 });
  }

  try {
    const row = toAudienceRow(audience);
    await d1Query(
      `INSERT INTO Audience (id, name, type, estimatedSize, config, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.type, row.estimatedSize, row.config, row.createdAt]
    );
    return NextResponse.json(audience, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
