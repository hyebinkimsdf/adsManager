const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSyntheticLast7Days,
  validateTestPerformanceInput,
  replaceLast7Days,
  TEST_SPEND_MAX,
  TEST_CONVERSIONS_MAX,
  TEST_REVENUE_MAX,
} = require("@/lib/dev/testPerformanceData");

function sum(days, key) {
  return days.reduce((s, d) => s + d[key], 0);
}

test("buildSyntheticLast7Days produces exactly 7 days whose totals exactly match the input, including remainders", () => {
  const days = buildSyntheticLast7Days(100000, 17, 250000);
  assert.equal(days.length, 7);
  assert.equal(sum(days, "spend"), 100000);
  assert.equal(sum(days, "conversions"), 17);
  assert.equal(sum(days, "revenue"), 250000);
  for (const d of days) {
    assert.ok(d.spend >= 0 && d.conversions >= 0 && d.revenue >= 0 && d.clicks >= 0 && d.impressions >= 0);
  }
});

test("buildSyntheticLast7Days handles all-zero input without throwing or producing negative values", () => {
  const days = buildSyntheticLast7Days(0, 0, 0);
  assert.equal(sum(days, "spend"), 0);
  assert.equal(sum(days, "conversions"), 0);
  assert.equal(sum(days, "revenue"), 0);
  assert.equal(sum(days, "clicks"), 0);
});

test("buildSyntheticLast7Days gives spend without conversions a minimum click floor so CTR math never divides by zero downstream", () => {
  const days = buildSyntheticLast7Days(50000, 0, 0);
  assert.ok(sum(days, "clicks") >= 10);
});

test("validateTestPerformanceInput accepts well-formed non-negative integers", () => {
  const result = validateTestPerformanceInput(100000, 5, 200000);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { spend: 100000, conversions: 5, revenue: 200000 });
});

test("validateTestPerformanceInput rejects negative, non-integer and out-of-range values", () => {
  assert.equal(validateTestPerformanceInput(-1, 0, 0).ok, false);
  assert.equal(validateTestPerformanceInput(1000.5, 0, 0).ok, false);
  assert.equal(validateTestPerformanceInput(TEST_SPEND_MAX + 1, 0, 0).ok, false);
  assert.equal(validateTestPerformanceInput(0, TEST_CONVERSIONS_MAX + 1, 0).ok, false);
  assert.equal(validateTestPerformanceInput(0, 0, TEST_REVENUE_MAX + 1).ok, false);
  assert.equal(validateTestPerformanceInput(0, 0, Number.NaN).ok, false);
});

test("replaceLast7Days keeps everything before the last 7 entries untouched for trend comparisons", () => {
  const olderDays = Array.from({ length: 7 }, (_, i) => ({ label: `OLD-${i}`, spend: 999, impressions: 1, clicks: 1, conversions: 1, revenue: 999 }));
  const currentLast7 = Array.from({ length: 7 }, (_, i) => ({ label: `CUR-${i}`, spend: 1, impressions: 1, clicks: 1, conversions: 1, revenue: 1 }));
  const history = [...olderDays, ...currentLast7];
  const next = replaceLast7Days(history, { spend: 70000, conversions: 7, revenue: 140000 });
  assert.equal(next.length, 14);
  assert.deepEqual(next.slice(0, 7), olderDays);
  assert.equal(sum(next.slice(-7), "spend"), 70000);
});

test("replaceLast7Days works even when the campaign started with fewer than 7 days of history", () => {
  const history = [{ label: "D-0", spend: 1, impressions: 1, clicks: 1, conversions: 0, revenue: 0 }];
  const next = replaceLast7Days(history, { spend: 21000, conversions: 3, revenue: 42000 });
  assert.equal(next.length, 7);
  assert.equal(sum(next, "spend"), 21000);
});
