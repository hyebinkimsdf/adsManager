import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { CAMPAIGNS } from "@/lib/mock/campaigns";
import { toCampaign, toCampaignRow, type CampaignRow } from "@/lib/campaigns/serialize";

export async function POST() {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    await d1Query("DELETE FROM Campaign");
    for (const campaign of CAMPAIGNS) {
      const row = toCampaignRow(campaign);
      await d1Query(
        `INSERT INTO Campaign (id, name, channels, objective, industry, status, dailyBudget, targeting, history)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.name, row.channels, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history]
      );
    }
    const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign ORDER BY createdAt DESC");
    return NextResponse.json(rows.map(toCampaign));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
