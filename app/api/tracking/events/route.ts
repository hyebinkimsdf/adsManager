import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
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

export async function GET(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }
  try {
    await assertTrackingSchema();
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
