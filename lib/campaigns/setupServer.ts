import { createHash, randomUUID } from "node:crypto";
import { d1Query } from "@/lib/d1";
import { toCampaign, type CampaignRow } from "@/lib/campaigns/serialize";
import {
  defaultCampaignName, isSetupDate, planDays, staticBudgetRecommendation, validateCampaignSetup,
  type CampaignSetupOptions, type CampaignSetupRequest, type TrackingConnectionOption,
} from "@/lib/campaigns/setup";
import { INDUSTRY_LABEL, OBJECTIVE_LABEL } from "@/lib/mock/campaigns";
import type { Campaign, CampaignIndustry, DisplayObjective } from "@/lib/mock/types";

type Query = typeof d1Query;
interface SetupRow extends CampaignRow { setupRequestHash: string; }

export class CampaignSetupError extends Error {
  constructor(message: string, public readonly status = 400, public readonly outcome: "not_saved" | "unknown" = "not_saved") { super(message); }
}

export function isCampaignSetupSchemaError(error: unknown): boolean {
  return error instanceof Error && /no such (?:table|column)|has no column named|ON CONFLICT clause does not match/i.test(error.message);
}

export interface SetupRecommendationInput {
  objective: DisplayObjective;
  industry: CampaignIndustry;
  startDate: string;
  endDate: string | null;
}

/** Only aggregate statistics leave the database; no other owner's rows are sent to the model. */
export async function getCampaignSetupOptions(
  ownerId: string,
  input: SetupRecommendationInput,
  query: Query = d1Query,
  allowBenchmarks = process.env.ENABLE_CROSS_ACCOUNT_BENCHMARKS === "true",
): Promise<CampaignSetupOptions> {
  const trackingConnections = await query<TrackingConnectionOption>(
    `SELECT id, name, siteUrl FROM TrackingConnection
     WHERE ownerId = ? AND status = 'connected' AND verifiedAt IS NOT NULL
     AND revokedAt IS NULL ORDER BY name, id`, [ownerId],
  );
  const unavailable = (reason: string): CampaignSetupOptions => ({
    trackingConnections, budgetRecommendation: { totalBudget: null, source: "unavailable", reason },
  });
  if (!input.endDate || !isSetupDate(input.startDate) || !isSetupDate(input.endDate) || input.endDate < input.startDate) {
    return unavailable("종료일을 정하면 기간에 맞는 예산을 살펴볼 수 있어요.");
  }
  const days = planDays(input.startDate, input.endDate);
  const staticFallback = (): CampaignSetupOptions => ({
    trackingConnections,
    budgetRecommendation: {
      totalBudget: staticBudgetRecommendation(input.objective, input.industry, days), source: "static",
      reason: `${INDUSTRY_LABEL[input.industry]}·${OBJECTIVE_LABEL[input.objective]} 캠페인의 일반적인 시작 금액이에요. 성과를 보장하는 금액은 아니에요.`,
    },
  });
  // 실계정 벤치마크는 준비되고(allowBenchmarks) 데이터도 충분할 때만 쓴다 — 둘 중 하나라도
  // 부족하면 "10만원 고정"이 아니라 목표·업종 기준표(staticFallback)로 한 단계만 낮춘다.
  if (!allowBenchmarks) return staticFallback();
  const stats = await query<{ ownerCount: number; campaignCount: number; dailySpend: number | null }>(
    `WITH valid_days AS (
       SELECT c.id, c.ownerId, json_extract(h.value, '$.date') AS day,
              MAX(json_extract(h.value, '$.spend')) AS spend
       FROM Campaign c, json_each(CASE WHEN json_valid(c.history) THEN c.history ELSE '[]' END) h
       WHERE c.metricSource = 'live' AND c.objective = ? AND c.industry = ?
         AND c.ownerId IS NOT NULL AND trim(c.ownerId) <> ''
         AND json_type(h.value, '$.spend') IN ('integer', 'real')
         AND json_extract(h.value, '$.spend') >= 0
         AND length(json_extract(h.value, '$.date')) = 10
         AND date(json_extract(h.value, '$.date'), '+0 days') = json_extract(h.value, '$.date')
         AND json_extract(h.value, '$.date') >= date('now', '+9 hours', '-90 days')
         AND json_extract(h.value, '$.date') < date('now', '+9 hours')
       GROUP BY c.id, c.ownerId, day
     ), campaigns AS (
       SELECT id, ownerId, AVG(spend) AS dailySpend FROM valid_days
       GROUP BY id, ownerId HAVING COUNT(*) >= 7 AND SUM(spend) > 0
     ), owners AS (
       SELECT ownerId, AVG(dailySpend) AS dailySpend FROM campaigns GROUP BY ownerId
     )
     SELECT (SELECT COUNT(*) FROM owners) AS ownerCount,
            (SELECT COUNT(*) FROM campaigns) AS campaignCount,
            (SELECT AVG(dailySpend) FROM owners) AS dailySpend`,
    [input.objective, input.industry],
  );
  const stat = stats[0];
  if (!stat || stat.ownerCount < 5 || stat.campaignCount < 20 || !stat.dailySpend || !Number.isFinite(stat.dailySpend)) {
    return staticFallback();
  }
  const totalBudget = Math.max(100_000, Math.round(stat.dailySpend * days / 100) * 100);
  if (!Number.isSafeInteger(totalBudget)) return staticFallback();
  return {
    trackingConnections,
    budgetRecommendation: {
      totalBudget, source: "benchmark",
      reason: `최근 90일, 비슷한 광고의 하루 지출을 ${days}일에 맞췄어요. 성과를 보장하는 금액은 아니에요.`,
    },
  };
}

function requestHash(input: CampaignSetupRequest): string {
  // validateCampaignSetup fixes field order and strips untrusted properties before hashing.
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function createCampaignSetup(
  body: unknown, ownerId: string, query: Query = d1Query, now = new Date(),
): Promise<{ campaign: Campaign; created: boolean }> {
  const result = validateCampaignSetup(body);
  if (!result.ok) throw new CampaignSetupError(result.error);
  const input = result.value;
  const hash = requestHash(input);
  const existing = async () => (await query<SetupRow>(
    "SELECT * FROM Campaign WHERE ownerId = ? AND createRequestId = ?", [ownerId, input.requestId],
  ))[0];
  const replay = (row: SetupRow) => {
    if (row.setupRequestHash !== hash) throw new CampaignSetupError("이미 저장된 요청과 설정이 달라요. 캠페인 목록에서 먼저 확인해 주세요.", 409, "unknown");
    return { campaign: toCampaign(row), created: false };
  };
  const saved = await existing();
  if (saved) return replay(saved);
  const name = input.name || defaultCampaignName(now);
  const plannedDays = input.endDate ? planDays(input.startDate, input.endDate) : 7;
  // Compatibility estimate for old screens only; creation never enables ad delivery.
  const dailyBudget = Math.min(10_000_000, Math.max(1_000, Math.floor(input.totalBudget / plannedDays / 100) * 100));
  const rows = await query<SetupRow>(
    `INSERT INTO Campaign (
       id, name, adType, objective, industry, status, dailyBudget, targeting, history,
       metricSource, ownerId, totalBudget, startDate, endDate, trackingConnectionId,
       setupStatus, createRequestId, setupRequestHash
     ) SELECT ?, ?, 'display', ?, ?, 'paused', ?, ?, '[]', 'unverified', ?, ?, ?, ?, ?, ?, ?, ?
       WHERE (? IS NULL AND ? = 1) OR EXISTS (
         SELECT 1 FROM TrackingConnection WHERE id = ? AND ownerId = ?
         AND status = 'connected' AND verifiedAt IS NOT NULL AND revokedAt IS NULL
       )
       ON CONFLICT(ownerId, createRequestId) DO NOTHING RETURNING *`,
    [randomUUID(), name, input.objective, input.industry, dailyBudget,
      JSON.stringify({ ageRange: "전체", gender: "all", regions: [], interests: [] }),
      ownerId, input.totalBudget, input.startDate, input.endDate, input.trackingConnectionId,
      input.saveAsDraft ? "draft" : "configured", input.requestId, hash,
      input.trackingConnectionId, input.saveAsDraft ? 1 : 0, input.trackingConnectionId, ownerId],
  );
  if (rows[0]) return { campaign: toCampaign(rows[0]), created: true };
  const concurrent = await existing();
  if (concurrent) return replay(concurrent);
  throw new CampaignSetupError("선택한 코드의 연결을 확인할 수 없어요. 다시 고르거나 코드 없이 초안으로 저장해 주세요.", 409);
}
