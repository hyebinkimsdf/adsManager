import { d1Query } from "@/lib/d1";
import { CAMPAIGNS } from "@/lib/mock/campaigns";
import { toCampaignRow } from "@/lib/campaigns/serialize";
import { MY_OWNER_ID } from "@/lib/campaigns/owner";

// 배포 직후 DB가 비어 있으면 데모용 시드 캠페인을 한 번만 채워 넣는다.
// count 확인 자체가 매 요청마다 D1 REST 호출 1회를 더 쓰므로, 워밍업된 서버 인스턴스에서는
// 한 번 확인한 뒤 다시 확인하지 않는다(콜드 스타트마다 한 번씩만 다시 확인).
//
// GET /api/campaigns, /api/campaigns/summary, /api/campaigns/[id] 세 경로 모두 이 함수를 호출해야
// 한다 — 서버 인스턴스가 콜드스타트 후 처음 받는 요청이 이 셋 중 어느 것이든 데모 시드가 빠지지 않도록.
let seeded = false;
export async function ensureSeeded() {
  if (seeded) return;
  // 다른 유저 데이터가 같은 테이블에 섞여 있을 수 있어, "내 계정" 소유 행만 세어야 한다 —
  // 그렇지 않으면 다른 유저 데이터만 있고 내 계정 데이터가 없는 상태를 "이미 시드됨"으로 오판한다.
  const [{ count }] = await d1Query<{ count: number }>(
    "SELECT COUNT(*) as count FROM Campaign WHERE ownerId = ?",
    [MY_OWNER_ID]
  );
  if (count > 0) {
    seeded = true;
    return;
  }

  for (const campaign of CAMPAIGNS) {
    const row = toCampaignRow(campaign);
    await d1Query(
      `INSERT INTO Campaign (id, name, adType, objective, industry, status, dailyBudget, targeting, history, metricSource, ownerId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.adType, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history, row.metricSource, MY_OWNER_ID]
    );
  }
  seeded = true;
}
