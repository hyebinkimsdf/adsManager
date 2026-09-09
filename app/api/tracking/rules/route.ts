import { NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/d1";
import { EVENT_ORDER } from "@/lib/tracking/events";
import type { ConversionEventType, EventRule } from "@/lib/mock/types";

// GET은 방문자 사이트에 심는 pixel.js가 크로스 오리진으로 호출하므로 CORS를 열어둔다.
// POST는 adsManager 관리자 화면에서만 같은 오리진으로 호출하므로 CORS 헤더를 붙이지 않는다.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface RuleInput {
  selector?: string;
  trigger?: string;
  eventType?: string;
  label?: string;
}

function isValidRuleInput(v: RuleInput): v is Required<RuleInput> {
  return (
    typeof v.selector === "string" &&
    v.selector.length > 0 &&
    (v.trigger === "click" || v.trigger === "submit") &&
    typeof v.eventType === "string" &&
    EVENT_ORDER.includes(v.eventType as ConversionEventType) &&
    typeof v.label === "string"
  );
}

// pixel.js가 방문자 브라우저에서 자동으로 걸 트리거 목록을 받아간다.
export async function GET(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json([], { headers: CORS_HEADERS });
  }
  const campaignId = new URL(req.url).searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId가 필요합니다." }, { status: 400, headers: CORS_HEADERS });
  }
  try {
    const rows = await d1Query<{ id: string; campaignId: string; selector: string; trigger: string; eventType: string; label: string; enabled: number }>(
      "SELECT * FROM EventRule WHERE campaignId = ? AND enabled = 1",
      [campaignId]
    );
    const rules: EventRule[] = rows.map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      selector: row.selector,
      trigger: row.trigger as "click" | "submit",
      eventType: row.eventType as ConversionEventType,
      label: row.label,
      enabled: Boolean(row.enabled),
    }));
    return NextResponse.json(rules, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json([], { headers: CORS_HEADERS });
  }
}

// 관리자 화면의 "AI 자동 설정"에서 승인한 규칙으로 캠페인의 전체 규칙을 교체한다.
export async function POST(req: Request) {
  if (!isD1Configured()) {
    return NextResponse.json({ error: "Cloudflare D1이 설정되지 않았습니다." }, { status: 501 });
  }

  let body: { campaignId?: string; rules?: RuleInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!body.campaignId || typeof body.campaignId !== "string" || !Array.isArray(body.rules)) {
    return NextResponse.json({ error: "campaignId와 rules가 필요합니다." }, { status: 400 });
  }

  const validRules = body.rules.filter(isValidRuleInput);

  try {
    await d1Query("DELETE FROM EventRule WHERE campaignId = ?", [body.campaignId]);
    for (const rule of validRules) {
      await d1Query(
        "INSERT INTO EventRule (id, campaignId, selector, trigger, eventType, label, enabled) VALUES (?, ?, ?, ?, ?, ?, 1)",
        [`rule-${crypto.randomUUID()}`, body.campaignId, rule.selector, rule.trigger, rule.eventType, rule.label]
      );
    }

    const saved = await d1Query<{ id: string; campaignId: string; selector: string; trigger: string; eventType: string; label: string; enabled: number }>(
      "SELECT * FROM EventRule WHERE campaignId = ?",
      [body.campaignId]
    );
    const rules: EventRule[] = saved.map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      selector: row.selector,
      trigger: row.trigger as "click" | "submit",
      eventType: row.eventType as ConversionEventType,
      label: row.label,
      enabled: Boolean(row.enabled),
    }));
    return NextResponse.json(rules, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
