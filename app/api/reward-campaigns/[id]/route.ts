import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { toRewardCampaign, type RewardCampaignRow } from "@/lib/reward/serialize";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  const { id } = await params;

  let patch: { status?: string };
  try {
    patch = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (patch.status !== "active" && patch.status !== "paused") {
    return NextResponse.json({ error: "status는 active 또는 paused여야 합니다." }, { status: 400 });
  }

  try {
    await d1Query("UPDATE RewardCampaign SET status = ? WHERE id = ?", [patch.status, id]);
    const rows = await d1Query<RewardCampaignRow>("SELECT * FROM RewardCampaign WHERE id = ?", [id]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(toRewardCampaign(rows[0]));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  const { id } = await params;
  try {
    await d1Query("DELETE FROM RewardCampaign WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
