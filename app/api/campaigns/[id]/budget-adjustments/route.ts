import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { toCampaign, type CampaignRow } from "@/lib/campaigns/serialize";
import { MY_OWNER_ID } from "@/lib/campaigns/owner";
import { listBudgetAdjustments, computeAdjustmentEffect } from "@/lib/campaigns/budgetAdjustments";

// 캠페인의 예산 변경 이력과, 각 변경 이후 실데이터로 확인한 효과를 함께 내려준다 — "적용했더니
// 실제로 도움이 됐는지"를 나중에 확인할 수 있게 하는 화면(캠페인 상세 "예산 변경 이력")이 쓴다.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  const { id } = await params;
  try {
    const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign WHERE id = ? AND ownerId = ?", [id, MY_OWNER_ID]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
    }
    const campaign = toCampaign(rows[0]);
    const adjustments = await listBudgetAdjustments(id, MY_OWNER_ID);
    // createdAt DESC(최신이 0번)로 온다 — 각 항목의 효과는 "이 항목 이후 ~ 바로 다음으로 최신인
    // 항목 이전"까지의 데이터로만 본다. 그래야 조정이 여러 번 있었을 때 뒤 조정의 효과가 앞 조정
    // 탓으로 섞이지 않는다. 가장 최신 항목(index 0)은 위 경계가 없어 지금까지의 데이터를 다 본다.
    const items = adjustments.map((adjustment, index) => ({
      ...adjustment,
      effect: computeAdjustmentEffect(campaign, adjustment, adjustments[index - 1]?.createdAt),
    }));
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
