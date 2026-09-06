import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { CAMPAIGNS } from "@/lib/mock/campaigns";
import { toCampaign, toCampaignRow, type CampaignRow } from "@/lib/campaigns/serialize";
import type { Campaign } from "@/lib/mock/types";

// 배포 직후 DB가 비어 있으면 데모용 시드 캠페인을 한 번만 채워 넣는다.
async function ensureSeeded() {
  const [{ count }] = await d1Query<{ count: number }>("SELECT COUNT(*) as count FROM Campaign");
  if (count > 0) return;

  for (const campaign of CAMPAIGNS) {
    const row = toCampaignRow(campaign);
    await d1Query(
      `INSERT INTO Campaign (id, name, channels, objective, industry, status, dailyBudget, targeting, history)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.channels, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history]
    );
  }
}

export async function GET() {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    await ensureSeeded();
    const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign ORDER BY createdAt DESC");
    return NextResponse.json(rows.map(toCampaign));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }

  let campaign: Campaign;
  try {
    campaign = (await req.json()) as Campaign;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!campaign?.id || !campaign?.name) {
    return NextResponse.json({ error: "id와 name이 필요합니다." }, { status: 400 });
  }

  try {
    const row = toCampaignRow(campaign);
    await d1Query(
      `INSERT INTO Campaign (id, name, channels, objective, industry, status, dailyBudget, targeting, history)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.channels, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history]
    );
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
