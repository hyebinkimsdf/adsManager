import type { DashboardSummary } from "@/lib/insights";

// D1을 Workers 바인딩이 아니라 REST API로 호출하는 지금 구조에서는 요청마다 외부 HTTPS 왕복이
// 발생해 홈 대시보드 GET 하나에도 1~10초가 걸린다(계산량이 아니라 순전히 네트워크 왕복 비용).
// 서버 인스턴스 하나가 살아있는 동안만 유지하는 짧은 캐시로, 같은 인스턴스에 몰리는 반복 조회
// (재방문·새로고침·테스트용 반복 저장 후 확인)가 매번 그 왕복을 다시 치르지 않게 한다. 쓰기 경로가
// invalidate를 호출하지 않으면 최대 TTL_MS만큼 오래된 값을 보여줄 수 있으니, Campaign 테이블을
// 바꾸는 모든 라우트(POST/PATCH/DELETE)가 성공 직후 반드시 invalidateSummaryCache를 호출해야 한다.
const TTL_MS = 10_000;

let cached: { data: DashboardSummary; expiresAt: number } | null = null;

export function getCachedSummary(): DashboardSummary | null {
  if (!cached || cached.expiresAt < Date.now()) return null;
  return cached.data;
}

export function setCachedSummary(data: DashboardSummary): void {
  cached = { data, expiresAt: Date.now() + TTL_MS };
}

export function invalidateSummaryCache(): void {
  cached = null;
}
