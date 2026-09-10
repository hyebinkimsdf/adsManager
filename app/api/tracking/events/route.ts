import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { buildSeedEvents } from "@/lib/tracking/seed";
import { EVENT_ORDER } from "@/lib/tracking/events";
import { assertTrackingSchema, trackingError } from "@/lib/tracking/server";
import type { EventSource } from "@/lib/tracking/measurement";
import type { ConversionEvent, ConversionEventType } from "@/lib/mock/types";

const EVENT_SOURCES: EventSource[] = ["live", "test", "legacy"];

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
// 데모 이벤트는 source='legacy'로 저장돼 live 집계·추천 로직에서 항상 제외된다.
// (한 번의 INSERT에 너무 많은 바인딩 파라미터가 몰리지 않도록 25건씩 나눠 넣는다.)
// count 확인이 매 GET/POST마다 D1 REST 호출 1회를 더 쓰므로, 워밍업된 서버 인스턴스에서는
// 한 번 확인한 뒤 다시 확인하지 않는다(콜드 스타트마다 한 번씩만 다시 확인).
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  const [{ count }] = await d1Query<{ count: number }>("SELECT COUNT(*) as count FROM ConversionEvent");
  if (count > 0) {
    seeded = true;
    return;
  }

  // D1은 한 문장에 바인딩할 수 있는 파라미터 수에 제한이 있어(대략 100개) 6개 컬럼 기준 15건씩 나눠 넣는다.
  for (const batch of chunk(buildSeedEvents(), 15)) {
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const params = batch.flatMap((e) => [e.id, e.campaignId, e.eventType, e.value, e.occurredAt, e.source ?? "legacy"]);
    await d1Query(
      `INSERT INTO ConversionEvent (id, campaignId, eventType, value, occurredAt, source) VALUES ${placeholders}`,
      params
    );
  }
  seeded = true;
}

export async function GET(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    await assertTrackingSchema();
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
    const { status, body } = trackingError(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json(
      { error: "Cloudflare D1이 설정되지 않았습니다." },
      { status: 501, headers: CORS_HEADERS }
    );
  }

  let body: { campaignId?: string; eventType?: string; value?: number; source?: string; eventId?: string; orderId?: string };
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
  if (body.source !== undefined && !EVENT_SOURCES.includes(body.source as EventSource)) {
    return NextResponse.json(
      { error: `source는 ${EVENT_SOURCES.join(", ")} 중 하나여야 합니다.` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const event: ConversionEvent = {
    id: `evt-${crypto.randomUUID()}`,
    campaignId: body.campaignId,
    eventType: body.eventType as ConversionEventType,
    value: typeof body.value === "number" && Number.isFinite(body.value) ? Math.max(0, Math.round(body.value)) : 0,
    occurredAt: new Date().toISOString(),
    // 명시적 source가 없으면 pixel.js의 실제 방문자 전송으로 간주한다. 관리자 화면의 "테스트 전송"은
    // source: "test"를 명시적으로 보낸다(lib/tracking/eventsRepository.ts의 sendTestEvent 참고).
    source: (body.source as ConversionEvent["source"]) ?? "live",
    eventId: typeof body.eventId === "string" && body.eventId.trim() ? body.eventId.trim().slice(0, 128) : null,
    orderId: typeof body.orderId === "string" && body.orderId.trim() ? body.orderId.trim().slice(0, 128) : null,
  };

  try {
    await assertTrackingSchema();
    // eventId/orderId에 걸린 고유 인덱스와 충돌하면(재시도·이중 전송) 조용히 무시한다 — 새 행은 안
    // 생기지만, "이 행동은 이미 기록돼 있다"는 의미에서 클라이언트에는 여전히 성공으로 응답한다.
    await d1Query(
      `INSERT OR IGNORE INTO ConversionEvent (id, campaignId, eventType, value, occurredAt, source, eventId, orderId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.campaignId,
        event.eventType,
        event.value,
        event.occurredAt,
        event.source ?? "live",
        event.eventId ?? null,
        event.orderId ?? null,
      ]
    );
    return NextResponse.json(event, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    const { status, body: errorBody } = trackingError(err);
    return NextResponse.json(errorBody, { status, headers: CORS_HEADERS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
