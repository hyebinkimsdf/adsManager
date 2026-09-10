import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { CAMPAIGNS } from "@/lib/mock/campaigns";
import { toCampaign, toCampaignRow, type CampaignRow } from "@/lib/campaigns/serialize";
import { validateCampaignCreate } from "@/lib/campaigns/validate";

// 배포 직후 DB가 비어 있으면 데모용 시드 캠페인을 한 번만 채워 넣는다.
// count 확인 자체가 매 GET마다 D1 REST 호출 1회를 더 쓰므로, 워밍업된 서버 인스턴스에서는
// 한 번 확인한 뒤 다시 확인하지 않는다(콜드 스타트마다 한 번씩만 다시 확인).
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  const [{ count }] = await d1Query<{ count: number }>("SELECT COUNT(*) as count FROM Campaign");
  if (count > 0) {
    seeded = true;
    return;
  }

  for (const campaign of CAMPAIGNS) {
    const row = toCampaignRow(campaign);
    await d1Query(
      `INSERT INTO Campaign (id, name, adType, objective, industry, status, dailyBudget, targeting, history, metricSource)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.adType, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history, row.metricSource]
    );
  }
  seeded = true;
}

export async function GET() {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    await ensureSeeded();
    const rows = await d1Query<CampaignRow>("SELECT * FROM Campaign ORDER BY createdAt DESC");
    return NextResponse.json(rows.map(toCampaign));
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const validated = validateCampaignCreate(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const campaign = validated.value;

  try {
    // 신규 캠페인은 아직 실제 매체 실적이 붙지 않았으므로 명시적으로 unverified로 저장한다 —
    // 화면·AI가 이 캠페인의 history를 "실데이터"로 취급하지 않도록 하는 근거.
    const row = toCampaignRow({ ...campaign, metricSource: "unverified" });
    await d1Query(
      `INSERT INTO Campaign (id, name, adType, objective, industry, status, dailyBudget, targeting, history, metricSource)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.adType, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history, row.metricSource]
    );
    return NextResponse.json(toCampaign(row), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
