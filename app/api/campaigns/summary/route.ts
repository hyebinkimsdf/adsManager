import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { toCampaign, type CampaignRow } from "@/lib/campaigns/serialize";
import { buildDashboardSummary } from "@/lib/insights";
import { ensureSeeded } from "@/lib/campaigns/ensureSeed";
import { MY_OWNER_ID } from "@/lib/campaigns/owner";
import { getCachedSummary, setCachedSummary } from "@/lib/campaigns/summaryCache";

// 홈 대시보드가 필요로 하는 요약값만 계산해서 내려준다. 서버는 여전히 전체 캠페인 row를
// D1에서 읽지만(집계에 필요), 브라우저로는 캠페인이 몇 건이든 크기가 거의 일정한 요약 JSON만
// 내려간다 — `GET /api/campaigns`처럼 캠페인마다 14일 history를 통째로 실어 보내지 않는다.
//
// D1을 REST API로 호출해 요청마다 외부 HTTPS 왕복이 드는 지금 구조라, 짧은 TTL 캐시로 같은
// 서버 인스턴스에 몰리는 반복 조회의 왕복 횟수를 줄인다. 쓰기 라우트가 성공 시 반드시
// invalidateSummaryCache를 호출하므로, 캐시가 실제 변경 이후에도 낡은 값을 보여주는 건
// 최악의 경우에도 TTL_MS 이내로 제한된다.
export async function GET() {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  const cached = getCachedSummary();
  if (cached) return NextResponse.json(cached);
  try {
    await ensureSeeded();
    const rows = await d1Query<CampaignRow>(
      "SELECT * FROM Campaign WHERE ownerId = ? ORDER BY createdAt DESC, id DESC",
      [MY_OWNER_ID]
    );
    const summary = buildDashboardSummary(rows.map(toCampaign));
    setCachedSummary(summary);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
