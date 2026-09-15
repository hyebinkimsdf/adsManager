import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { toCampaign, type CampaignRow } from "@/lib/campaigns/serialize";
import { validateCampaignPatch, validateBudgetChangeMeta } from "@/lib/campaigns/validate";
import { ensureSeeded } from "@/lib/campaigns/ensureSeed";
import { MY_OWNER_ID } from "@/lib/campaigns/owner";
import { recordBudgetAdjustment } from "@/lib/campaigns/budgetAdjustments";
import { sumHistory } from "@/lib/mock/campaigns";

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

  const budgetMeta = validateBudgetChangeMeta(body);
  if (!budgetMeta.ok) {
    return NextResponse.json({ error: budgetMeta.error }, { status: 400 });
  }

  const columns: Record<string, unknown> = {};
  if (patch.name !== undefined) columns.name = patch.name;
  if (patch.adType !== undefined) columns.adType = patch.adType;
  if (patch.objective !== undefined) columns.objective = patch.objective;
  if (patch.industry !== undefined) columns.industry = patch.industry;
  if (patch.status !== undefined) columns.status = patch.status;
  if (patch.dailyBudget !== undefined) columns.dailyBudget = patch.dailyBudget;
  if (patch.targeting !== undefined) columns.targeting = JSON.stringify(patch.targeting);
  if (patch.history !== undefined) columns.history = JSON.stringify(patch.history);
  if (patch.startDate !== undefined) columns.startDate = patch.startDate;
  if (patch.endDate !== undefined) columns.endDate = patch.endDate;

  const fields = Object.keys(columns);
  if (fields.length === 0) {
    return NextResponse.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
  }

  const budgetChanged = patch.dailyBudget !== undefined;

  try {
    // status를 active로 바꾸거나 예산을 바꿀 때는 변경 직전 상태가 필요하다(전자는 setupStatus 확인,
    // 후자는 변경 이력의 previousBudget·baseline 실적) — 한 번만 조회해 두 용도로 같이 쓴다.
    let current: CampaignRow | undefined;
    if (patch.status === "active" || budgetChanged) {
      const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign WHERE id = ? AND ownerId = ?", [id, MY_OWNER_ID]);
      current = rows[0];
    }
    if (patch.status === "active" && current?.setupStatus) {
      return NextResponse.json({ error: "설정은 저장됐지만 광고 시작 기능은 아직 연결되지 않았어요." }, { status: 409 });
    }

    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    // 예산이 바뀔 때마다 서버 시각으로 기록한다(클라이언트 값은 신뢰하지 않음) — 방금 조정한
    // 캠페인을 관찰 기간 동안 예산 추천에서 빼는 근거(lib/insights.ts의 BUDGET_COOLDOWN_DAYS)로 쓴다.
    await d1Query(
      `UPDATE Campaign SET ${setClause}, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')${
        budgetChanged ? ", lastBudgetAdjustmentAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : ""
      } WHERE id = ? AND ownerId = ?`,
      [...fields.map((f) => columns[f] as string | number | null), id, MY_OWNER_ID]
    );
    const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign WHERE id = ? AND ownerId = ?", [id, MY_OWNER_ID]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
    }

    // 감사 로그는 부가 기능이다 — 여기서 실패해도 이미 반영된 예산 변경 자체를 실패로 되돌리거나
    // 사용자에게 에러로 보여주지 않는다(방금 성공한 저장을 실패로 오인하게 만들 수 있기 때문).
    if (budgetChanged && current) {
      try {
        const baselineTotals = sumHistory(toCampaign(current).history.slice(-7));
        await recordBudgetAdjustment({
          campaignId: id,
          ownerId: MY_OWNER_ID,
          source: budgetMeta.value.source ?? "manual",
          reasonKind: budgetMeta.value.reasonKind,
          previousBudget: current.dailyBudget,
          newBudget: patch.dailyBudget!,
          baseline: { spend: baselineTotals.spend, conversions: baselineTotals.conversions, roas: baselineTotals.roas },
        });
      } catch (logErr) {
        console.error("[budget-adjustment-log]", logErr);
      }
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
