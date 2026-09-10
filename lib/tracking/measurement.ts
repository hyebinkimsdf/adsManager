import type { ConversionEventType } from "@/lib/mock/types";
import { EVENT_ORDER } from "./events";

export type EventSource = "live" | "test" | "legacy";
export interface MeasurementQuery { start: string; end: string; source: EventSource; campaignId?: string }
export interface CampaignMeasurement { campaignId: string; totalEvents: number; counts: Record<ConversionEventType, number>; purchaseRevenue: number }
export interface MeasurementSummary {
  period: { start: string; end: string; timeZone: "Asia/Seoul" };
  source: EventSource;
  campaignId: string | null;
  totalEvents: number;
  counts: Record<ConversionEventType, number>;
  purchaseRevenue: number;
  latestEventAt: string | null;
  byCampaign: CampaignMeasurement[];
  excluded: { test: number; legacy: number };
}
const DAY_MS = 86_400_000;
export function getDefaultMeasurementQuery(now = new Date()): MeasurementQuery {
  const today = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return { start: new Date(today.getTime() - 13 * DAY_MS).toISOString().slice(0, 10), end: today.toISOString().slice(0, 10), source: "live" };
}
export function emptyEventCounts(): Record<ConversionEventType, number> {
  return Object.fromEntries(EVENT_ORDER.map((type) => [type, 0])) as Record<ConversionEventType, number>;
}
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function parseMeasurementQuery(params: URLSearchParams): MeasurementQuery {
  const defaults = getDefaultMeasurementQuery();
  const start = params.get("start") ?? defaults.start;
  const end = params.get("end") ?? defaults.end;
  const source = params.get("source") ?? "live";
  const campaignId = params.get("campaignId") || undefined;
  if (!validDate(start) || !validDate(end) || start > end) throw new Error("조회 시작일과 종료일을 YYYY-MM-DD 형식으로 올바르게 지정해 주세요.");
  if (!["live", "test", "legacy"].includes(source)) throw new Error("source는 live, test, legacy 중 하나여야 합니다.");
  if (campaignId && (campaignId.length > 128 || !campaignId.trim())) throw new Error("올바른 campaignId가 필요합니다.");
  return { start, end, source: source as EventSource, campaignId };
}
export function measurementBounds(query: MeasurementQuery): { from: string; until: string } {
  return { from: new Date(`${query.start}T00:00:00+09:00`).toISOString(), until: new Date(Date.parse(`${query.end}T00:00:00+09:00`) + DAY_MS).toISOString() };
}
export function measurementSearchParams(query: Partial<MeasurementQuery> = {}): string {
  const resolved = { ...getDefaultMeasurementQuery(), ...query };
  const params = new URLSearchParams({ start: resolved.start, end: resolved.end, source: resolved.source });
  if (resolved.campaignId) params.set("campaignId", resolved.campaignId);
  return params.toString();
}
