const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isBudgetRequest, handleBudgetRequest } = require("@/lib/ai/budgetRequest");

function campaign(overrides = {}) {
  return {
    id: "camp-1",
    name: "쇼핑몰 캠페인",
    status: "active",
    objective: "purchase",
    industry: "shopping",
    dailyBudget: 100000,
    ctr: 2,
    cpa: 10000,
    roas: 150,
    spendTrendPercent: 0,
    ...overrides,
  };
}

const two = [campaign(), campaign({ id: "camp-2", name: "뷰티 캠페인", dailyBudget: 50000 })];

test("isBudgetRequest ignores unrelated chat messages", () => {
  assert.equal(isBudgetRequest("이번 주 성과 어때?"), false);
  assert.equal(isBudgetRequest("캠페인 멈춰줘"), false);
});

test("isBudgetRequest recognizes raise/lower/absolute-amount phrasing", () => {
  assert.equal(isBudgetRequest("예산 늘려줘"), true);
  assert.equal(isBudgetRequest("예산 줄여줘"), true);
  assert.equal(isBudgetRequest("7만원으로 바꿔줘"), true);
  assert.equal(isBudgetRequest("예산 좀 조정해줘"), true);
});

test("falls through for non-budget messages", () => {
  const outcome = handleBudgetRequest("이번 주 성과 어때?", two, null);
  assert.equal(outcome.kind, "not_budget_request");
});

test("does not guess a campaign when the target is ambiguous", () => {
  const outcome = handleBudgetRequest("예산 늘려줘", two, null);
  assert.equal(outcome.kind, "clarify");
  assert.equal(outcome.reply.actions.length, 0);
  assert.deepEqual(
    outcome.reply.quickReplies,
    two.map((c) => `${c.name} 예산 늘려줘`)
  );
});

test("uses the focused campaign when the message names no campaign", () => {
  const outcome = handleBudgetRequest("예산 늘려줘", two, "camp-2");
  assert.equal(outcome.kind, "resolved");
  const [action] = outcome.reply.actions;
  assert.equal(action.campaignId, "camp-2");
  assert.equal(action.percent, 15);
});

test("uses the only campaign when there is just one, even unfocused", () => {
  const outcome = handleBudgetRequest("예산 줄여줘", [campaign()], null);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions[0].campaignId, "camp-1");
  assert.equal(outcome.reply.actions[0].percent, -15);
});

test("an explicit mention resolves the campaign directly", () => {
  const outcome = handleBudgetRequest("뷰티 캠페인 예산 20% 늘려줘", two, null);
  assert.equal(outcome.kind, "resolved");
  const [action] = outcome.reply.actions;
  assert.equal(action.campaignId, "camp-2");
  assert.equal(action.percent, 20);
});

test("parses an absolute target amount instead of a percent", () => {
  const outcome = handleBudgetRequest("쇼핑몰 캠페인 7만원으로 늘려줘", two, null);
  assert.equal(outcome.kind, "resolved");
  const [action] = outcome.reply.actions;
  assert.equal(action.targetAmount, 70000);
  assert.equal(action.percent, undefined);
});

test("rejects an absolute amount above the allowed ceiling without proposing an action", () => {
  const outcome = handleBudgetRequest("쇼핑몰 캠페인 2000만원으로 늘려줘", two, null);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions.length, 0);
});

test("rejects a percent request above the max single-step adjustment", () => {
  const outcome = handleBudgetRequest("쇼핑몰 캠페인 50% 늘려줘", two, null);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions.length, 0);
});

test("asks for a direction when the campaign is known but the change is vague", () => {
  const outcome = handleBudgetRequest("쇼핑몰 캠페인 예산 바꿔줘", two, null);
  assert.equal(outcome.kind, "clarify");
  assert.equal(outcome.reply.actions.length, 0);
  assert.ok(outcome.reply.quickReplies.every((q) => q.startsWith("쇼핑몰 캠페인")));
});

test("reports no-op when the requested amount matches the current budget", () => {
  const outcome = handleBudgetRequest("쇼핑몰 캠페인 10만원으로 늘려줘", two, null);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions.length, 0);
});

test("handles an empty campaign list without throwing", () => {
  const outcome = handleBudgetRequest("예산 늘려줘", [], null);
  assert.equal(outcome.kind, "resolved");
  assert.equal(outcome.reply.actions.length, 0);
});
