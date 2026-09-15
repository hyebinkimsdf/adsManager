const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateCampaignCreate, validateCampaignPatch, validateTargeting } = require("@/lib/campaigns/validate");

const validTargeting = { ageRange: "20-30", gender: "all", regions: ["seoul"], interests: ["food"] };

function validCampaign(overrides = {}) {
  return {
    id: "camp-1",
    name: "테스트 캠페인",
    adType: "display",
    objective: "purchase",
    industry: "food",
    status: "active",
    dailyBudget: 50000,
    targeting: validTargeting,
    history: [],
    ...overrides,
  };
}

test("validateCampaignCreate accepts a well-formed campaign", () => {
  const result = validateCampaignCreate(validCampaign());
  assert.equal(result.ok, true);
});

test("validateCampaignCreate rejects a negative daily budget", () => {
  const result = validateCampaignCreate(validCampaign({ dailyBudget: -1000 }));
  assert.equal(result.ok, false);
});

test("validateCampaignCreate rejects a non-integer daily budget", () => {
  const result = validateCampaignCreate(validCampaign({ dailyBudget: 1234.5 }));
  assert.equal(result.ok, false);
});

test("validateCampaignCreate rejects a daily budget above the allowed ceiling", () => {
  const result = validateCampaignCreate(validCampaign({ dailyBudget: 50_000_000 }));
  assert.equal(result.ok, false);
});

test("validateCampaignCreate rejects an unknown status", () => {
  const result = validateCampaignCreate(validCampaign({ status: "deleted" }));
  assert.equal(result.ok, false);
});

test("validateCampaignCreate rejects targeting sent as a string instead of an object", () => {
  const result = validateCampaignCreate(validCampaign({ targeting: "20대 서울 여성" }));
  assert.equal(result.ok, false);
});

test("validateCampaignCreate rejects an id with unsafe characters", () => {
  const result = validateCampaignCreate(validCampaign({ id: "camp/../1" }));
  assert.equal(result.ok, false);
});

test("validateCampaignCreate rejects a missing name", () => {
  const campaign = validCampaign();
  delete campaign.name;
  const result = validateCampaignCreate(campaign);
  assert.equal(result.ok, false);
});

test("validateCampaignPatch accepts a partial update with only dailyBudget", () => {
  const result = validateCampaignPatch({ dailyBudget: 80000 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { dailyBudget: 80000 });
});

test("validateCampaignPatch ignores fields that were not provided", () => {
  const result = validateCampaignPatch({ status: "paused" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { status: "paused" });
});

test("validateCampaignPatch rejects a negative daily budget", () => {
  const result = validateCampaignPatch({ dailyBudget: -5 });
  assert.equal(result.ok, false);
});

test("validateCampaignPatch rejects an empty object body with no error on absent fields", () => {
  const result = validateCampaignPatch({});
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {});
});

test("validateCampaignPatch accepts a valid startDate/endDate pair", () => {
  const result = validateCampaignPatch({ startDate: "2026-01-01", endDate: "2026-01-31" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { startDate: "2026-01-01", endDate: "2026-01-31" });
});

test("validateCampaignPatch accepts a null endDate", () => {
  const result = validateCampaignPatch({ startDate: "2026-01-01", endDate: null });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { startDate: "2026-01-01", endDate: null });
});

test("validateCampaignPatch rejects a malformed startDate", () => {
  const result = validateCampaignPatch({ startDate: "2026/01/01" });
  assert.equal(result.ok, false);
});

test("validateCampaignPatch rejects an endDate before startDate", () => {
  const result = validateCampaignPatch({ startDate: "2026-01-31", endDate: "2026-01-01" });
  assert.equal(result.ok, false);
});

test("validateTargeting rejects a gender value outside the enum", () => {
  const result = validateTargeting({ ...validTargeting, gender: "other" });
  assert.equal(result.ok, false);
});

test("validateTargeting rejects non-string entries inside regions", () => {
  const result = validateTargeting({ ...validTargeting, regions: [1, 2] });
  assert.equal(result.ok, false);
});
