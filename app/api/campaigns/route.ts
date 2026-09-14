import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { toCampaign, toCampaignRow, type CampaignRow } from "@/lib/campaigns/serialize";
import { validateCampaignCreate } from "@/lib/campaigns/validate";
import { ensureSeeded } from "@/lib/campaigns/ensureSeed";
import { MY_OWNER_ID } from "@/lib/campaigns/owner";

const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 20;

// 목록 페이지처럼 필요한 곳만 opt-in 하도록, limit 파라미터가 없으면 기존과 동일하게 전체를
// 반환한다(다른 화면들이 여전히 이 무제한 응답에 의존하고 있어 하위호환을 깨지 않기 위함).
export async function GET(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    await ensureSeeded();

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    if (!limitParam) {
      const rows = await d1Query<CampaignRow>(
        "SELECT * FROM Campaign WHERE ownerId = ? ORDER BY createdAt DESC, id DESC",
        [MY_OWNER_ID]
      );
      return NextResponse.json(rows.map(toCampaign));
    }

    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(limitParam) || DEFAULT_PAGE_LIMIT));
    const cursor = url.searchParams.get("cursor");

    let rows: CampaignRow[];
    if (cursor) {
      const separatorIndex = cursor.lastIndexOf("|");
      const cursorCreatedAt = separatorIndex >= 0 ? cursor.slice(0, separatorIndex) : "";
      const cursorId = separatorIndex >= 0 ? cursor.slice(separatorIndex + 1) : "";
      if (!cursorCreatedAt || !cursorId) {
        return NextResponse.json({ error: "잘못된 cursor입니다." }, { status: 400 });
      }
      // id(PK)를 2차 정렬키로 묶는 keyset pagination — createdAt에 인덱스가 없고 값이 중복될 수
      // 있어도 (createdAt, id) 조합은 항상 유일해서 커서가 안정적으로 다음 페이지를 가리킨다.
      rows = await d1Query<CampaignRow>(
        `SELECT * FROM Campaign WHERE ownerId = ? AND ((createdAt < ?) OR (createdAt = ? AND id < ?))
         ORDER BY createdAt DESC, id DESC LIMIT ?`,
        [MY_OWNER_ID, cursorCreatedAt, cursorCreatedAt, cursorId, limit]
      );
    } else {
      rows = await d1Query<CampaignRow>(
        "SELECT * FROM Campaign WHERE ownerId = ? ORDER BY createdAt DESC, id DESC LIMIT ?",
        [MY_OWNER_ID, limit]
      );
    }

    const last = rows.at(-1);
    const nextCursor = rows.length === limit && last?.createdAt ? `${last.createdAt}|${last.id}` : null;
    return NextResponse.json({ items: rows.map(toCampaign), nextCursor });
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
      `INSERT INTO Campaign (id, name, adType, objective, industry, status, dailyBudget, targeting, history, metricSource, ownerId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.adType, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history, row.metricSource, MY_OWNER_ID]
    );
    return NextResponse.json(toCampaign(row), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
