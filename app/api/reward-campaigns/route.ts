import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { validateRewardDraft } from "@/lib/reward/rules";
import { toRewardCampaign, toRewardCampaignRow, type RewardCampaignRow } from "@/lib/reward/serialize";
import type { RewardCampaign } from "@/lib/mock/types";

export async function GET() {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    const rows = await d1Query<RewardCampaignRow>("SELECT * FROM RewardCampaign ORDER BY createdAt DESC");
    return NextResponse.json(rows.map(toRewardCampaign));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }

  let campaign: RewardCampaign;
  try {
    campaign = (await req.json()) as RewardCampaign;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const validationError = validateRewardDraft(campaign);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const row = toRewardCampaignRow(campaign);
    await d1Query(
      `INSERT INTO RewardCampaign (id, name, productType, status, config, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.productType, row.status, row.config, row.createdAt]
    );
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
