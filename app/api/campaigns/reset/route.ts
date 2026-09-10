import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { CAMPAIGNS } from "@/lib/mock/campaigns";
import { toCampaign, toCampaignRow, type CampaignRow } from "@/lib/campaigns/serialize";

// 데모 시드로 전체 캠페인 테이블을 되돌리는 개발용 작업이다. 운영 데이터를 통째로 지울 수 있어
// 프로덕션에서는 관리자 인증이 있어도 막는다.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "캠페인 초기화는 개발 환경에서만 실행할 수 있습니다." }, { status: 403 });
  }
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    await d1Query("DELETE FROM Campaign");
    for (const campaign of CAMPAIGNS) {
      const row = toCampaignRow(campaign);
      await d1Query(
        `INSERT INTO Campaign (id, name, adType, objective, industry, status, dailyBudget, targeting, history, metricSource)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.name, row.adType, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history, row.metricSource]
      );
    }
    const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign ORDER BY createdAt DESC");
    return NextResponse.json(rows.map(toCampaign));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
