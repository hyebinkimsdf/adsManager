import { d1Query } from "@/lib/d1";
export class TrackingSchemaError extends Error {}
export async function assertTrackingSchema(): Promise<void> {
  const columns = await d1Query<{ name: string }>("PRAGMA table_info(ConversionEvent)");
  if (!["source", "eventId", "orderId"].every((name) => columns.some((column) => column.name === name))) {
    throw new TrackingSchemaError("측정 데이터 마이그레이션이 필요합니다. d1/migrations/0001_measurement_integrity.sql을 적용한 뒤 다시 시도해 주세요.");
  }
}
export function trackingError(error: unknown): { status: number; body: { error: string; code?: string } } {
  if (error instanceof TrackingSchemaError) return { status: 503, body: { error: error.message, code: "TRACKING_MIGRATION_REQUIRED" } };
  return { status: 500, body: { error: "측정 데이터를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." } };
}
