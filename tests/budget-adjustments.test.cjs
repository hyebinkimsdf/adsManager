const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { recordBudgetAdjustment, listBudgetAdjustments, computeAdjustmentEffect } = require("@/lib/campaigns/budgetAdjustments");
const { validateBudgetChangeMeta } = require("@/lib/campaigns/validate");

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(join(__dirname, "../d1/schema.sql"), "utf8"));
  const query = async (sql, params = []) => db.prepare(sql).all(...params);
  return { db, query };
}

function insertCampaign(db, overrides = {}) {
  const row = {
    id: "camp-1", name: "테스트", objective: "purchase", industry: "food", status: "active",
    dailyBudget: 50000, targeting: "{}", history: "[]", metricSource: "unverified", ownerId: "owner-primary",
    ...overrides,
  };
  db.prepare(
    "INSERT INTO Campaign (id,name,objective,industry,status,dailyBudget,targeting,history,metricSource,ownerId) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(row.id, row.name, row.objective, row.industry, row.status, row.dailyBudget, row.targeting, row.history, row.metricSource, row.ownerId);
  return row;
}

function campaign(overrides = {}) {
  return {
    id: "camp-1", name: "테스트", adType: "display", objective: "purchase", industry: "food", status: "active",
    dailyBudget: 50000, targeting: { ageRange: "20-30", gender: "all", regions: [], interests: [] }, history: [],
    ...overrides,
  };
}

test("validateBudgetChangeMeta accepts a well-formed recommendation source and reason", () => {
  const result = validateBudgetChangeMeta({ budgetChangeSource: "recommendation", budgetChangeReasonKind: "lower_budget" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { source: "recommendation", reasonKind: "lower_budget" });
});

test("validateBudgetChangeMeta defaults to nulls when the body carries neither field", () => {
  assert.deepEqual(validateBudgetChangeMeta({ dailyBudget: 1000 }).value, { source: null, reasonKind: null });
  assert.deepEqual(validateBudgetChangeMeta(undefined).value, { source: null, reasonKind: null });
});

test("validateBudgetChangeMeta rejects a source or reasonKind outside the enum", () => {
  assert.equal(validateBudgetChangeMeta({ budgetChangeSource: "ai" }).ok, false);
  assert.equal(validateBudgetChangeMeta({ budgetChangeReasonKind: "focus_target" }).ok, false);
});

test("recordBudgetAdjustment stores previous/new budget, percent and baseline, listBudgetAdjustments reads them back newest first", async () => {
  const { db, query } = database();
  try {
    insertCampaign(db);
    await recordBudgetAdjustment({
      campaignId: "camp-1", ownerId: "owner-primary", source: "manual", reasonKind: null,
      previousBudget: 50000, newBudget: 60000, baseline: { spend: 70000, conversions: 3, roas: 120 },
    }, query);
    await recordBudgetAdjustment({
      campaignId: "camp-1", ownerId: "owner-primary", source: "recommendation", reasonKind: "raise_budget",
      previousBudget: 60000, newBudget: 69000, baseline: { spend: 60000, conversions: 5, roas: 180 },
    }, query);
    const rows = await listBudgetAdjustments("camp-1", "owner-primary", query);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].source, "recommendation"); // newest first
    assert.equal(rows[0].reasonKind, "raise_budget");
    assert.equal(rows[0].previousBudget, 60000);
    assert.equal(rows[0].newBudget, 69000);
    assert.equal(rows[0].percent, 15);
    assert.equal(rows[1].source, "manual");
    assert.equal(rows[1].reasonKind, null);
    assert.equal(Math.round(rows[1].percent), 20);
  } finally { db.close(); }
});

test("recordBudgetAdjustment stores a null percent when the previous budget was zero (avoids divide-by-zero)", async () => {
  const { db, query } = database();
  try {
    insertCampaign(db);
    await recordBudgetAdjustment({
      campaignId: "camp-1", ownerId: "owner-primary", source: "manual", reasonKind: null,
      previousBudget: 0, newBudget: 10000, baseline: { spend: 0, conversions: 0, roas: 0 },
    }, query);
    const rows = await listBudgetAdjustments("camp-1", "owner-primary", query);
    assert.equal(rows[0].percent, null);
  } finally { db.close(); }
});

test("listBudgetAdjustments never leaks another owner's history for the same campaign id", async () => {
  const { db, query } = database();
  try {
    insertCampaign(db, { ownerId: "owner-other" });
    await recordBudgetAdjustment({
      campaignId: "camp-1", ownerId: "owner-other", source: "manual", reasonKind: null,
      previousBudget: 1000, newBudget: 2000, baseline: { spend: 0, conversions: 0, roas: 0 },
    }, query);
    const rows = await listBudgetAdjustments("camp-1", "owner-primary", query);
    assert.equal(rows.length, 0);
  } finally { db.close(); }
});

test("computeAdjustmentEffect refuses to judge demo/unverified campaigns instead of comparing meaningless data", () => {
  const c = campaign({ metricSource: "unverified" });
  const adjustment = { createdAt: "2026-09-10T00:00:00.000Z", baselineSpend: 1000, baselineConversions: 1, baselineRoas: 100 };
  const effect = computeAdjustmentEffect(c, adjustment);
  assert.equal(effect.status, "unavailable");
});

test("computeAdjustmentEffect stays pending until enough new dated days have accumulated", () => {
  const c = campaign({
    metricSource: "live",
    history: [
      { date: "2026-09-11", spend: 1000, impressions: 10, clicks: 5, conversions: 1, revenue: 2000 },
      { date: "2026-09-12", spend: 1000, impressions: 10, clicks: 5, conversions: 1, revenue: 2000 },
    ],
  });
  const adjustment = { createdAt: "2026-09-10T00:00:00.000Z", baselineSpend: 7000, baselineConversions: 2, baselineRoas: 80 };
  const effect = computeAdjustmentEffect(c, adjustment);
  assert.equal(effect.status, "pending");
  assert.equal(effect.newDataDays, 2);
  assert.match(effect.message, /2\/3/);
});

test("computeAdjustmentEffect reports improved/worsened/flat once enough new data exists", () => {
  const daysAfter = (roasBoost) => [
    { date: "2026-09-11", spend: 1000, impressions: 10, clicks: 5, conversions: 1, revenue: roasBoost },
    { date: "2026-09-12", spend: 1000, impressions: 10, clicks: 5, conversions: 1, revenue: roasBoost },
    { date: "2026-09-13", spend: 1000, impressions: 10, clicks: 5, conversions: 1, revenue: roasBoost },
  ];
  const adjustment = { createdAt: "2026-09-10T00:00:00.000Z", baselineSpend: 3000, baselineConversions: 3, baselineRoas: 100 };

  const improved = computeAdjustmentEffect(campaign({ metricSource: "live", history: daysAfter(2000) }), adjustment); // roas 200%
  assert.equal(improved.status, "ready");
  assert.equal(improved.verdict, "improved");

  const worsened = computeAdjustmentEffect(campaign({ metricSource: "live", history: daysAfter(300) }), adjustment); // roas 30%
  assert.equal(worsened.status, "ready");
  assert.equal(worsened.verdict, "worsened");

  const flat = computeAdjustmentEffect(campaign({ metricSource: "live", history: daysAfter(1000) }), adjustment); // roas 100%, no change
  assert.equal(flat.status, "ready");
  assert.equal(flat.verdict, "flat");
});

test("computeAdjustmentEffect's until bound keeps a later adjustment's data from bleeding into an earlier one's effect", () => {
  const c = campaign({
    metricSource: "live",
    history: [
      { date: "2026-09-11", spend: 1000, impressions: 10, clicks: 5, conversions: 1, revenue: 3000 }, // between the two adjustments
      { date: "2026-09-13", spend: 1000, impressions: 10, clicks: 5, conversions: 1, revenue: 9000 }, // after the second adjustment
    ],
  });
  const first = { createdAt: "2026-09-10T00:00:00.000Z", baselineSpend: 1000, baselineConversions: 1, baselineRoas: 100 };
  // Without an until bound this would count both days (2), crossing the pending threshold and mixing
  // the second adjustment's much higher revenue into the first adjustment's reported effect.
  const withoutBound = computeAdjustmentEffect(c, first);
  const withBound = computeAdjustmentEffect(c, first, "2026-09-12T00:00:00.000Z");
  assert.equal(withoutBound.newDataDays, 2);
  assert.equal(withBound.newDataDays, 1);
  assert.equal(withBound.status, "pending");
});
