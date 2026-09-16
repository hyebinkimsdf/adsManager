import { NextResponse } from "next/server";
import { isD1Configured } from "@/lib/d1";
import { MY_OWNER_ID } from "@/lib/campaigns/owner";
import { INDUSTRIES, OBJECTIVES } from "@/lib/campaigns/validate";
import { koreaDate } from "@/lib/campaigns/setup";
import { CampaignSetupError, createCampaignSetup, getCampaignSetupOptions, isCampaignSetupSchemaError } from "@/lib/campaigns/setupServer";
import { requireSameOriginMutation } from "@/lib/server/access";
import { invalidateSummaryCache } from "@/lib/campaigns/summaryCache";
import type { CampaignIndustry, DisplayObjective } from "@/lib/mock/types";

function failure(error: unknown) {
  if (error instanceof CampaignSetupError) return NextResponse.json({ error: error.message, outcome: error.outcome }, { status: error.status });
  if (isCampaignSetupSchemaError(error)) return NextResponse.json({ error: "새 캠페인 저장 기능을 준비 중이에요. 관리자의 데이터베이스 업데이트가 필요해요.", outcome: "not_saved" }, { status: 503 });
  // No SQL, credentials or other-owner data in public errors.
  return NextResponse.json({ error: "저장 준비가 아직 안 됐어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
}

// 포트폴리오 공개 기간(2026-10 중순까지) 동안은 관리자 인증 없이 열어둔다 — 이 경로가 어시스턴트·
// 캠페인 설정 카드가 쓰는 일반 사용자 플로우라, 인증을 걸면 방문자가 앱을 써볼 수 없다. 공개가
// 끝나면 requireAdminRequest(req)를 다시 걸어야 한다.
export async function GET(req: Request) {
  if (!isD1Configured()) return failure(null);
  const params = new URL(req.url).searchParams;
  const objective = params.get("objective") ?? "purchase";
  const industry = params.get("industry") ?? "etc";
  if (!OBJECTIVES.includes(objective as DisplayObjective) || !INDUSTRIES.includes(industry as CampaignIndustry)) {
    return NextResponse.json({ error: "광고 목표와 업종을 확인해 주세요." }, { status: 400 });
  }
  try {
    const data = await getCampaignSetupOptions(MY_OWNER_ID, {
      objective: objective as DisplayObjective, industry: industry as CampaignIndustry,
      startDate: params.get("startDate") ?? koreaDate(), endDate: params.get("endDate") || null,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  const denied = requireSameOriginMutation(req);
  if (denied) return denied;
  if (!isD1Configured()) return failure(null);
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "입력 내용을 확인해 주세요." }, { status: 400 }); }
  try {
    const { campaign, created } = await createCampaignSetup(body, MY_OWNER_ID);
    if (created) invalidateSummaryCache();
    return NextResponse.json(campaign, { status: created ? 201 : 200 });
  } catch (error) { return failure(error); }
}
