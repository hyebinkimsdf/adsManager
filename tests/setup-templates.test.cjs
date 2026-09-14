const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCampaignSetupDraft } = require("@/lib/campaigns/setup");
const { applySetupTemplate } = require("@/lib/campaigns/setupTemplates");

function draft(patch = {}) {
  return { ...createCampaignSetupDraft(new Date("2026-09-12T16:00:00Z"), "req-1"), ...patch };
}

test("templates only touch budget and end date — objective and industry the user already set survive", () => {
  const base = draft({ objective: "app_install", industry: "finance" });
  for (const id of ["recommended", "conversion", "custom"]) {
    const result = applySetupTemplate(id, base, null);
    assert.equal(result.objective, "app_install");
    assert.equal(result.industry, "finance");
    assert.equal(result.name, base.name);
    assert.equal(result.startDate, base.startDate);
  }
});

test("custom starts at the bare minimum budget over the standard 7-day window", () => {
  const result = applySetupTemplate("custom", draft(), 9999999);
  assert.equal(result.totalBudget, 100000);
  assert.equal(result.endDate, "2026-09-19"); // startDate + 6 days
});

test("recommended prefers a live recommendation but falls back to the static table when none is available", () => {
  const withLive = applySetupTemplate("recommended", draft(), 350000);
  assert.equal(withLive.totalBudget, 350000);
  const withoutLive = applySetupTemplate("recommended", draft({ objective: "purchase", industry: "etc" }), null);
  assert.equal(withoutLive.totalBudget, 490000); // static table: 70000/day * 1.0 * 7 days
});

test("conversion is always noticeably larger than recommended and runs twice as long, regardless of live data", () => {
  const recommended = applySetupTemplate("recommended", draft({ objective: "purchase", industry: "etc" }), null);
  const conversion = applySetupTemplate("conversion", draft({ objective: "purchase", industry: "etc" }), null);
  assert.ok(conversion.totalBudget > recommended.totalBudget * 1.4, "conversion budget should clear ~1.5x the 7-day recommendation");
  assert.equal(conversion.endDate, "2026-09-26"); // startDate + 13 days = 14-day window
  // A live (benchmark-sourced) number for the *old* 7-day window must not shrink the 14-day conversion budget.
  const conversionIgnoresLiveShortWindow = applySetupTemplate("conversion", draft({ objective: "purchase", industry: "etc" }), 1);
  assert.equal(conversionIgnoresLiveShortWindow.totalBudget, conversion.totalBudget);
});

test("conversion template never triggers the setup checklist's own 5x budget-too-high warning", () => {
  const { evaluateSetupChecklist } = require("@/lib/campaigns/setupChecklist");
  for (const objective of ["purchase", "app_install", "leads", "visit", "reach"]) {
    for (const industry of ["food", "beauty", "education", "medical", "shopping", "realestate", "finance", "it_app", "etc"]) {
      const base = draft({ objective, industry });
      const recommendation = { totalBudget: require("@/lib/campaigns/setup").staticBudgetRecommendation(objective, industry, 7), source: "static", reason: "" };
      const result = applySetupTemplate("conversion", base, recommendation.totalBudget);
      const items = evaluateSetupChecklist(result, recommendation, true);
      assert.equal(items.some((i) => i.id === "budget-high"), false, `${objective}/${industry} unexpectedly flagged as too high`);
    }
  }
});
