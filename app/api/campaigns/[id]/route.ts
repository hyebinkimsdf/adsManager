import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { toCampaign, type CampaignRow } from "@/lib/campaigns/serialize";
import { validateCampaignPatch } from "@/lib/campaigns/validate";
import { ensureSeeded } from "@/lib/campaigns/ensureSeed";
import { MY_OWNER_ID } from "@/lib/campaigns/owner";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  const { id } = await params;
  try {
    await ensureSeeded();
    const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign WHERE id = ? AND ownerId = ?", [id, MY_OWNER_ID]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(toCampaign(rows[0]));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const validated = validateCampaignPatch(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const patch = validated.value;

  const columns: Record<string, unknown> = {};
  if (patch.name !== undefined) columns.name = patch.name;
  if (patch.adType !== undefined) columns.adType = patch.adType;
  if (patch.objective !== undefined) columns.objective = patch.objective;
  if (patch.industry !== undefined) columns.industry = patch.industry;
  if (patch.status !== undefined) columns.status = patch.status;
  if (patch.dailyBudget !== undefined) columns.dailyBudget = patch.dailyBudget;
  if (patch.targeting !== undefined) columns.targeting = JSON.stringify(patch.targeting);
  if (patch.history !== undefined) columns.history = JSON.stringify(patch.history);

  const fields = Object.keys(columns);
  if (fields.length === 0) {
    return NextResponse.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
  }

  try {
    if (patch.status === "active") {
      const current = await d1Query<CampaignRow>("SELECT * FROM Campaign WHERE id = ? AND ownerId = ?", [id, MY_OWNER_ID]);
      if (current[0]?.setupStatus) {
        return NextResponse.json({ error: "설정은 저장됐지만 광고 시작 기능은 아직 연결되지 않았어요." }, { status: 409 });
      }
    }
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    await d1Query(
      `UPDATE Campaign SET ${setClause}, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND ownerId = ?`,
      [...fields.map((f) => columns[f] as string | number), id, MY_OWNER_ID]
    );
    const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign WHERE id = ? AND ownerId = ?", [id, MY_OWNER_ID]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(toCampaign(rows[0]));
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
    await d1Query("DELETE FROM Campaign WHERE id = ? AND ownerId = ?", [id, MY_OWNER_ID]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
