const { test } = require("node:test");
const assert = require("node:assert/strict");
const { BUDGET_TIERS, nearestBudgetTier, budgetRangeForTier } = require("@/lib/campaigns/budgetTiers");
const { MIN_DAILY_BUDGET, MAX_DAILY_BUDGET } = require("@/lib/campaigns/validate");
const { kstDate } = require("@/lib/campaignMetrics");
const { findComparableCampaigns, decideBudgetRecommendation, templateBudgetReasoning } = require("@/lib/campaigns/budgetRecommendation");
const { buildBudgetRecommendationUserTurnEn, BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN } = require("@/lib/ai/budgetRecommendationPrompt");

const targeting = { ageRange: "20-30", gender: "all", regions: [], interests: [] };
function campaign(overrides = {}) {
  return {
    id: "camp-1", name: "테스트 캠페인", adType: "display", objective: "purchase", industry: "food",
    status: "active", dailyBudget: 100000, targeting, metricSource: "live", history: [], ...overrides,
  };
}
function dayWithRoas(roas, spend = 1000) {
  return { label: "D-0", date: kstDate(), spend, impressions: 100, clicks: 10, conversions: 1, revenue: (spend * roas) / 100 };
}
function peer(overrides = {}) {
  return campaign({ id: "peer", history: [dayWithRoas(200)], ...overrides });
}

test("nearestBudgetTier picks the closest tier and ties go to the lower tier", () => {
  for (const [budget, tier] of [[45000, 30000], [65000, 30000], [65001, 100000], [150000, 100000], [150001, 200000]]) {
    assert.equal(nearestBudgetTier(budget).daily, tier);
  }
});

test("tier ranges cover every valid integer budget without overlap and match nearest tier", () => {
  const ranges = BUDGET_TIERS.map((tier) => budgetRangeForTier(tier.daily));
  assert.equal(ranges[0].min, MIN_DAILY_BUDGET);
  assert.equal(ranges[0].max + 1, ranges[1].min);
  assert.equal(ranges[1].max + 1, ranges[2].min);
  assert.equal(ranges[2].max, MAX_DAILY_BUDGET);
  ranges.forEach((range, index) => {
    assert.equal(nearestBudgetTier(range.min).daily, BUDGET_TIERS[index].daily);
    assert.equal(nearestBudgetTier(range.max).daily, BUDGET_TIERS[index].daily);
  });
});

test("unknown tier falls back to full valid range", () => {
  assert.deepEqual(budgetRangeForTier(999), { min: MIN_DAILY_BUDGET, max: MAX_DAILY_BUDGET });
});

test("comparables exclude self, other objectives, no spend, no revenue, and ROAS below 100", () => {
  const target = peer({ id: "camp-1" });
  const all = [target, peer({ id: "other-objective", objective: "leads" }),
    peer({ id: "no-history", history: [] }), peer({ id: "no-spend", history: [dayWithRoas(300, 0)] }),
    peer({ id: "no-revenue", history: [dayWithRoas(0)] }), peer({ id: "low", history: [dayWithRoas(99)] }), peer()];
  assert.deepEqual(findComparableCampaigns(target, all).map((c) => c.id), ["peer"]);
});

test("comparables prefer same industry then ROAS and respect limit", () => {
  const all = [peer({ id: "same-low", history: [dayWithRoas(100)] }),
    peer({ id: "other-high", industry: "beauty", history: [dayWithRoas(900)] }),
    peer({ id: "same-high", history: [dayWithRoas(300)] })];
  assert.deepEqual(findComparableCampaigns(campaign(), all, 2).map((c) => c.id), ["same-high", "same-low"]);
});

test("comparables require age, gender, region, and interest overlap", () => {
  const exact = { ageRange: "20-30", gender: "female", regions: ["서울"], interests: ["음식"] };
  const target = campaign({ targeting: exact });
  const all = [
    peer({ id: "age", targeting: { ...exact, ageRange: "35-54" } }),
    peer({ id: "gender", targeting: { ...exact, gender: "male" } }),
    peer({ id: "region", targeting: { ...exact, regions: ["부산"] } }),
    peer({ id: "interest", targeting: { ...exact, interests: ["뷰티"] } }),
    peer({ id: "overlap", targeting: { ...exact, ageRange: "25-44" } }),
    peer({ id: "broad", targeting: { ageRange: "전체", gender: "all", regions: ["전국"], interests: [] } }),
  ];
  assert.deepEqual(findComparableCampaigns(target, all).map((c) => c.id).sort(), ["broad", "overlap"]);
});

test("live comparisons reject demo, unverified, missing source, undated and stale data", () => {
  const all = [peer(), peer({ id: "demo", metricSource: "demo" }),
    peer({ id: "unverified", metricSource: "unverified" }), peer({ id: "missing", metricSource: undefined }),
    peer({ id: "undated", history: [{ ...dayWithRoas(200), date: undefined }] }),
    peer({ id: "stale", history: [{ ...dayWithRoas(200), date: "2020-01-01" }] })];
  assert.deepEqual(findComparableCampaigns(campaign(), all).map((c) => c.id), ["peer"]);
  assert.deepEqual(findComparableCampaigns(campaign({ metricSource: "unverified" }), all), []);
  assert.deepEqual(findComparableCampaigns(campaign({ metricSource: "demo" }), all).map((c) => c.id), ["demo"]);
});

test("high tier with no comparables retains 200000 instead of jumping to millions", () => {
  const facts = decideBudgetRecommendation(campaign({ dailyBudget: 200000 }), [], budgetRangeForTier(200000));
  assert.equal(facts.recommendedBudget, 200000);
  assert.equal(facts.direction, "flat");
  assert.equal(facts.comparableMedianBudget, null);
});

test("no comparables preserves a current budget that is not a multiple of 100", () => {
  const facts = decideBudgetRecommendation(campaign({ dailyBudget: 200123 }), [], budgetRangeForTier(200000));
  assert.equal(facts.recommendedBudget, 200123);
});

test("changing tier without comparables chooses its nearest boundary", () => {
  const facts = decideBudgetRecommendation(campaign({ dailyBudget: 30000 }), [], budgetRangeForTier(100000));
  assert.equal(facts.baselineBudget, 65001);
  assert.equal(facts.recommendedBudget, 65001);
  assert.match(templateBudgetReasoning(facts), /현재 일 예산에 가장 가까운/);
});

test("extreme peer budgets cannot move a 200000 baseline more than 20 percent", () => {
  const facts = decideBudgetRecommendation(campaign({ dailyBudget: 200000 }), [peer({ dailyBudget: 10000000 })], budgetRangeForTier(200000));
  assert.equal(facts.recommendedBudget, 240000);
  assert.equal(facts.direction, "up");
});

test("median reference resists one extreme peer and gently follows ordinary budgets", () => {
  const facts = decideBudgetRecommendation(campaign({ dailyBudget: 200000 }), [
    peer({ id: "a", dailyBudget: 200000 }), peer({ id: "b", dailyBudget: 220000 }), peer({ id: "c", dailyBudget: 10000000 }),
  ], budgetRangeForTier(200000));
  assert.equal(facts.comparableMedianBudget, 220000);
  assert.equal(facts.recommendedBudget, 210000);
});

test("higher peer ROAS does not mechanically increase the budget", () => {
  const facts = decideBudgetRecommendation(campaign({ dailyBudget: 100000, history: [dayWithRoas(200)] }),
    [peer({ dailyBudget: 80000, history: [dayWithRoas(1000)] })], budgetRangeForTier(100000));
  assert.equal(facts.recommendedBudget, 90000);
  assert.equal(facts.direction, "down");
});

test("own ROAS 200 and peer ROAS 100 never yields false poor-performance explanation", () => {
  const facts = decideBudgetRecommendation(campaign({ dailyBudget: 100000, history: [dayWithRoas(200)] }),
    [peer({ dailyBudget: 60000, history: [dayWithRoas(100)] })], budgetRangeForTier(100000));
  assert.equal(facts.direction, "down");
  assert.equal(facts.ownRoas, 200);
  assert.equal(facts.comparableAvgRoas, 100);
  const explanation = templateBudgetReasoning(facts);
  assert.match(explanation, /일 예산 중앙값 60,000원/);
  assert.doesNotMatch(explanation, /성과가 낮|더 좋은 성과|성과가 비슷|범위의 중간/);
  const prompt = buildBudgetRecommendationUserTurnEn(facts);
  assert.match(prompt, /ownRoas=200.0/);
  assert.match(prompt, /avgRoas=100.0/);
  assert.match(prompt, /medianDailyBudget=60000/);
  assert.match(BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN, /Never infer relative performance from the change direction/);
});

test("recommendations stay inside the selected range even when peers are outside it", () => {
  for (const dailyBudget of [1000, 10000000]) {
    const facts = decideBudgetRecommendation(campaign({ dailyBudget: 50000 }), [peer({ dailyBudget })], { min: 49000, max: 51000 });
    assert.ok(facts.recommendedBudget >= 49000 && facts.recommendedBudget <= 51000);
  }
});

test("recommendation function independently excludes unqualified peer inputs", () => {
  const facts = decideBudgetRecommendation(campaign({ dailyBudget: 200000 }), [peer({ objective: "leads", dailyBudget: 10000000 })], budgetRangeForTier(200000));
  assert.equal(facts.comparableCount, 0);
  assert.equal(facts.recommendedBudget, 200000);
});

test("missing own metrics are unknown instead of falsely reported as zero ROAS", () => {
  const facts = decideBudgetRecommendation(campaign(), [], budgetRangeForTier(100000));
  assert.equal(facts.ownRoas, null);
  assert.match(buildBudgetRecommendationUserTurnEn(facts), /ownRoas=unknown/);
});
