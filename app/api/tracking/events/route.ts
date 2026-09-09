import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { buildSeedEvents } from "@/lib/tracking/seed";
import { EVENT_ORDER } from "@/lib/tracking/events";
import type { ConversionEvent, ConversionEventType } from "@/lib/mock/types";

// 외부 사이트에 심는 pixel.js가 크로스 오리진으로 이 엔드포인트를 호출하므로 POST는 CORS를 열어둔다.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// 배포 직후 이벤트가 하나도 없으면 캠페인 지표 기반 데모 이벤트를 한 번만 채워 넣는다.
// (한 번의 INSERT에 너무 많은 바인딩 파라미터가 몰리지 않도록 25건씩 나눠 넣는다.)
async function ensureSeeded() {
  const [{ count }] = await d1Query<{ count: number }>("SELECT COUNT(*) as count FROM ConversionEvent");
  if (count > 0) return;

  // D1은 한 문장에 바인딩할 수 있는 파라미터 수에 제한이 있어(대략 100개) 5개 컬럼 기준 15건씩 나눠 넣는다.
  for (const batch of chunk(buildSeedEvents(), 15)) {
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const params = batch.flatMap((e) => [e.id, e.campaignId, e.eventType, e.value, e.occurredAt]);
    await d1Query(
      `INSERT INTO ConversionEvent (id, campaignId, eventType, value, occurredAt) VALUES ${placeholders}`,
      params
    );
  }
}

export async function GET(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    await ensureSeeded();
    const campaignId = new URL(req.url).searchParams.get("campaignId");
    const rows = campaignId
      ? await d1Query<ConversionEvent>(
          "SELECT * FROM ConversionEvent WHERE campaignId = ? ORDER BY occurredAt DESC LIMIT 200",
          [campaignId]
        )
      : await d1Query<ConversionEvent>("SELECT * FROM ConversionEvent ORDER BY occurredAt DESC LIMIT 200");
    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json(
      { error: "Cloudflare D1이 설정되지 않았습니다." },
      { status: 501, headers: CORS_HEADERS }
    );
  }

  let body: { campaignId?: string; eventType?: string; value?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400, headers: CORS_HEADERS });
  }

  if (!body.campaignId || typeof body.campaignId !== "string" || !EVENT_ORDER.includes(body.eventType as ConversionEventType)) {
    return NextResponse.json(
      { error: `campaignId와 유효한 eventType(${EVENT_ORDER.join(", ")})이 필요합니다.` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const event: ConversionEvent = {
    id: `evt-${crypto.randomUUID()}`,
    campaignId: body.campaignId,
    eventType: body.eventType as ConversionEventType,
    value: typeof body.value === "number" && Number.isFinite(body.value) ? Math.max(0, Math.round(body.value)) : 0,
    occurredAt: new Date().toISOString(),
  };

  try {
    await d1Query(
      "INSERT INTO ConversionEvent (id, campaignId, eventType, value, occurredAt) VALUES (?, ?, ?, ?, ?)",
      [event.id, event.campaignId, event.eventType, event.value, event.occurredAt]
    );
    return NextResponse.json(event, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
