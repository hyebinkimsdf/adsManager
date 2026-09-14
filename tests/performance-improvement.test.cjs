const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hasImprovementIntent, handleImprovementRequest } = require("@/lib/ai/performanceImprovement");

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

// ROAS 300% — 양호
const good = campaign({ id: "camp-alpha", name: "알파 캠페인" });
// ROAS 30% — 저효율(150% 미만)
const bad = campaign({
  id: "camp-beta",
  name: "베타 캠페인",
  history: [day({ spend: 100000, impressions: 10000, clicks: 500, conversions: 5, revenue: 30000 })],
});
// 지출은 있지만 전환이 0 — 완전 손실
const noConversions = campaign({
  id: "camp-gamma",
  name: "감마 캠페인",
  history: [day({ spend: 100000, impressions: 10000, clicks: 500, conversions: 0, revenue: 0 })],
});

test("hasImprovementIntent detects action-intent words", () => {
  assert.equal(hasImprovementIntent("전환률이 낮은 캠페인 개선해줘"), true);
  assert.equal(hasImprovementIntent("성과 낮은 캠페인 알려줘"), false);
  assert.equal(hasImprovementIntent("이번 주 성과 어때?"), false);
});

test("not_applicable when the message has no improvement intent", () => {
  const outcome = handleImprovementRequest("전환률 낮은 캠페인 알려줘", [good, bad]);
  assert.equal(outcome.kind, "not_applicable");
});

test("proposes a budget cut for the worst-ROAS campaign when no campaign is named", () => {
  const outcome = handleImprovementRequest("전환률이 낮은 캠페인 개선해줘", [good, bad]);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions.length, 1);
  assert.equal(outcome.reply.actions[0].type, "adjust_budget");
  assert.equal(outcome.reply.actions[0].campaignId, "camp-beta");
  assert.equal(outcome.reply.actions[0].percent, -20);
});

test("proposes pausing a campaign with spend but zero conversions", () => {
  const outcome = handleImprovementRequest("감마 캠페인 개선해줘", [good, noConversions]);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions.length, 1);
  assert.equal(outcome.reply.actions[0].type, "pause_campaign");
  assert.equal(outcome.reply.actions[0].campaignId, "camp-gamma");
});

test("a named, healthy campaign gets an explanation with no forced action", () => {
  const outcome = handleImprovementRequest("알파 캠페인 개선해줘", [good, bad]);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions.length, 0);
});

test("handles an empty campaign list without throwing", () => {
  const outcome = handleImprovementRequest("캠페인 개선해줘", []);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions.length, 0);
});
