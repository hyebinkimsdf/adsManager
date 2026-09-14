const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCampaignSetupDraft } = require("@/lib/campaigns/setup");
const { evaluateSetupChecklist, describeSetupNextSteps } = require("@/lib/campaigns/setupChecklist");

function draft(patch = {}) {
  return { ...createCampaignSetupDraft(new Date("2026-09-12T16:00:00Z"), "req-1"), ...patch };
}

test("a fully filled-in, well-funded, tracked setup has no warnings", () => {
  const items = evaluateSetupChecklist(
    draft({ industry: "shopping", totalBudget: 1000000 }),
    { totalBudget: 490000, source: "static", reason: "" },
    true,
  );
  assert.deepEqual(items, []);
});

test("flags a budget under half the recommendation", () => {
  const items = evaluateSetupChecklist(draft({ totalBudget: 100000 }), { totalBudget: 490000, source: "static", reason: "" }, true);
  assert.ok(items.some((i) => i.id === "budget-low"));
});

test("flags a budget over 5x the recommendation as a likely typo", () => {
  const items = evaluateSetupChecklist(draft({ totalBudget: 3000000 }), { totalBudget: 490000, source: "static", reason: "" }, true);
  assert.ok(items.some((i) => i.id === "budget-high"));
  assert.equal(items.some((i) => i.id === "budget-low"), false);
});

test("does not flag budget when there is no recommendation to compare against", () => {
  const items = evaluateSetupChecklist(draft({ totalBudget: 100000 }), { totalBudget: null, source: "unavailable", reason: "" }, true);
  assert.equal(items.some((i) => i.id === "budget-low"), false);
  assert.equal(items.some((i) => i.id === "budget-high"), false);
});

test("flags a short duration but not an open-ended (no end date) campaign", () => {
  const short = evaluateSetupChecklist(draft({ endDate: "2026-09-14" }), undefined, true); // 2 days
  assert.ok(short.some((i) => i.id === "duration-short"));
  const openEnded = evaluateSetupChecklist(draft({ endDate: null }), undefined, true);
  assert.equal(openEnded.some((i) => i.id === "duration-short"), false);
});

test("flags missing tracking connection and unset (etc) industry", () => {
  const items = evaluateSetupChecklist(draft({ industry: "etc" }), undefined, false);
  assert.ok(items.some((i) => i.id === "no-tracking"));
  assert.ok(items.some((i) => i.id === "industry-etc"));
});

test("unknown tracking/budget status (still loading) never shows a false no-tracking or budget warning, but draft-only checks still fire instantly", () => {
  // recommendation and hasTrackingConnection are undefined exactly like the card passes while its
  // options fetch is in flight — this must not blank out checks that don't need that fetch at all.
  const items = evaluateSetupChecklist(draft({ industry: "etc", endDate: "2026-09-14" }), undefined, undefined);
  assert.equal(items.some((i) => i.id === "no-tracking"), false, "must not flash a false warning before we actually know");
  assert.equal(items.some((i) => i.id === "budget-low" || i.id === "budget-high"), false, "no baseline yet, nothing to compare against");
  assert.ok(items.some((i) => i.id === "industry-etc"), "industry is known from the draft alone, should not wait on a fetch");
  assert.ok(items.some((i) => i.id === "duration-short"), "duration is known from the draft alone, should not wait on a fetch");
});

test("next steps tell the truth about launch: connecting a code does not mean the campaign can start", () => {
  const withoutCode = describeSetupNextSteps({ trackingConnectionId: null });
  assert.ok(withoutCode.some((s) => s.key === "tracking" && s.href === "/tracking"));
  assert.equal(withoutCode.some((s) => s.key === "launch-pending"), false);

  const withCode = describeSetupNextSteps({ trackingConnectionId: "code-1" });
  assert.ok(withCode.some((s) => s.key === "launch-pending" && !s.href), "launch-pending is informational only, no dead link");
  assert.equal(withCode.some((s) => s.key === "tracking"), false);

  // Both cases should still point at registering a creative.
  for (const steps of [withoutCode, withCode]) {
    assert.ok(steps.some((s) => s.key === "creative" && s.href === "/creatives"));
  }
});
