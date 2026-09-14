const { test } = require("node:test");
const assert = require("node:assert/strict");
const { handlePerformanceQuery } = require("@/lib/ai/performanceQuery");

function day(overrides = {}) {
  return { label: "D-0", spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ...overrides };
}

function campaign(overrides = {}) {
  return {
    id: "camp-1",
    name: "쇼핑몰 캠페인",
    adType: "display",
    objective: "purchase",
    industry: "shopping",
    status: "active",
    dailyBudget: 100000,
    targeting: { ageRange: "전체", gender: "all", regions: [], interests: [] },
    history: [day({ spend: 100000, impressions: 10000, clicks: 500, conversions: 50, revenue: 300000 })],
    ...overrides,
  };
}

// 전환율 10%, CTR 5%, CPA 2000원, ROAS 300%
const good = campaign({ id: "camp-alpha", name: "알파 캠페인" });
// 전환율 1%, CTR 5%, CPA 20000원, ROAS 30% — 클릭은 충분(500)하지만 전환이 적음
const bad = campaign({
  id: "camp-beta",
  name: "베타 캠페인",
  history: [day({ spend: 100000, impressions: 10000, clicks: 500, conversions: 5, revenue: 30000 })],
});
// 클릭이 0 — 전환율/CTR 계산 불가
const noClicks = campaign({
  id: "camp-gamma",
  name: "감마 캠페인",
  history: [day({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })],
});

test("ignores messages without a recognizable metric keyword", () => {
  const outcome = handlePerformanceQuery("이번 주 성과 어때?", [good, bad]);
  assert.equal(outcome.kind, "not_query");
});

test("ignores a metric keyword with no direction and no campaign mention", () => {
  const outcome = handlePerformanceQuery("전환율이 뭐야?", [good, bad]);
  assert.equal(outcome.kind, "not_query");
});

test("finds the lowest conversion rate across the full list", () => {
  const outcome = handlePerformanceQuery("전환율이 제일 낮은 캠페인은?", [good, bad, noClicks]);
  assert.equal(outcome.kind, "resolved");
  assert.match(outcome.reply.reply, /베타 캠페인/);
  assert.match(outcome.reply.reply, /1\.0%/);
  // 클릭이 없는 캠페인은 계산 불가로 순위에서 제외되고, 그 사실이 답변에 드러나야 한다.
  assert.match(outcome.reply.reply, /1개 캠페인은 제외/);
});

test("treats a generic '성과 좋은/낮은' phrase as a ROAS ranking", () => {
  const goodOutcome = handlePerformanceQuery("성과 좋은 캠페인은 뭐야", [good, bad]);
  assert.equal(goodOutcome.kind, "resolved");
  assert.match(goodOutcome.reply.reply, /알파 캠페인/);

  const badOutcome = handlePerformanceQuery("성과 낮은 캠페인 알려줘", [good, bad]);
  assert.equal(badOutcome.kind, "resolved");
  assert.match(badOutcome.reply.reply, /베타 캠페인/);
});

test("treats other generic performance synonyms (효율/실적/효과/가성비) as a ROAS ranking too", () => {
  for (const word of ["효율", "실적", "효과", "가성비"]) {
    const outcome = handlePerformanceQuery(`${word} 좋은 캠페인 알려줘`, [good, bad]);
    assert.equal(outcome.kind, "resolved", `"${word}" should resolve`);
    assert.match(outcome.reply.reply, /알파 캠페인/, `"${word}" should rank 알파 캠페인 first`);
  }
});

test("a vague synonym question with no direction word still falls back to nano", () => {
  for (const word of ["효율", "실적", "효과", "가성비"]) {
    const outcome = handlePerformanceQuery(`이번 주 ${word} 어때?`, [good, bad]);
    assert.equal(outcome.kind, "not_query", `"${word} 어때?" should be not_query`);
  }
});

test("finds the highest ROAS", () => {
  const outcome = handlePerformanceQuery("ROAS 제일 높은 캠페인 알려줘", [good, bad]);
  assert.equal(outcome.kind, "resolved");
  assert.match(outcome.reply.reply, /알파 캠페인/);
  assert.match(outcome.reply.reply, /300%/);
});

test("CPA direction is inverted — lower cost is the good side", () => {
  const worseCpa = handlePerformanceQuery("CPA가 제일 나쁜 캠페인은?", [good, bad]);
  assert.equal(worseCpa.kind, "resolved");
  assert.match(worseCpa.reply.reply, /베타 캠페인/, "higher CPA (20,000원) should be reported as the worst");

  const bestCpa = handlePerformanceQuery("CPA가 제일 좋은 캠페인은?", [good, bad]);
  assert.equal(bestCpa.kind, "resolved");
  assert.match(bestCpa.reply.reply, /알파 캠페인/, "lower CPA (2,000원) should be reported as the best");
});

test("a named campaign with no direction word returns just that campaign's value", () => {
  const outcome = handlePerformanceQuery("알파 캠페인 전환율 얼마야?", [good, bad]);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.reply, "알파 캠페인의 전환율은 10.0%예요.");
});

test("reports missing data instead of a fabricated number when clicks are zero", () => {
  const outcome = handlePerformanceQuery("감마 캠페인 전환율 얼마야?", [good, bad, noClicks]);
  assert.equal(outcome.kind, "resolved");
  assert.match(outcome.reply.reply, /데이터가 부족/);
});

test("returns a not-fabricated response when nothing in scope is calculable", () => {
  const outcome = handlePerformanceQuery("전환율 제일 낮은 캠페인은?", [noClicks]);
  assert.equal(outcome.kind, "resolved");
  assert.match(outcome.reply.reply, /계산할 수 있는 캠페인이 없어요/);
});

test("handles an empty campaign list without throwing", () => {
  const outcome = handlePerformanceQuery("전환율 제일 낮은 캠페인은?", []);
  assert.equal(outcome.kind, "resolved");
  assert.match(outcome.reply.reply, /등록된 캠페인이 없어요/);
});
