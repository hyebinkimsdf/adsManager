const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hasVerifiedMetrics, metricDates, metricHistory, metricSeries, kstDate } = require("@/lib/campaignMetrics");

function campaign(overrides = {}) {
  return {
    id: "camp-1",
    name: "테스트 캠페인",
    adType: "display",
    objective: "purchase",
    industry: "food",
    status: "active",
    dailyBudget: 50000,
    targeting: { ageRange: "20-30", gender: "all", regions: [], interests: [] },
    history: [],
    ...overrides,
  };
}

function day(date, overrides = {}) {
  return { label: date, date, spend: 1000, impressions: 100, clicks: 10, conversions: 1, revenue: 5000, ...overrides };
}

test("hasVerifiedMetrics rejects a campaign with no metricSource (demo/unverified data)", () => {
  const c = campaign({ history: [day("2026-09-09")] });
  assert.equal(hasVerifiedMetrics(c), false);
});

test("hasVerifiedMetrics rejects metricSource: demo even with well-formed dated history", () => {
  const c = campaign({ metricSource: "demo", history: [day("2026-09-09")] });
  assert.equal(hasVerifiedMetrics(c), false);
});

test("hasVerifiedMetrics rejects live campaigns whose history has no date (legacy D-13 style rows)", () => {
  const c = campaign({ metricSource: "live", history: [{ label: "D-0", spend: 1, impressions: 1, clicks: 1, conversions: 0, revenue: 0 }] });
  assert.equal(hasVerifiedMetrics(c), false);
});

test("hasVerifiedMetrics rejects live campaigns with a negative metric value", () => {
  const c = campaign({ metricSource: "live", history: [day("2026-09-09", { spend: -1 })] });
  assert.equal(hasVerifiedMetrics(c), false);
});

test("hasVerifiedMetrics accepts a live campaign with well-formed dated history", () => {
  const c = campaign({ metricSource: "live", history: [day("2026-09-08"), day("2026-09-09")] });
  assert.equal(hasVerifiedMetrics(c), true);
});

test("metricDates returns the last N calendar dates in KST ending today, ascending", () => {
  const now = new Date("2026-09-10T01:00:00.000Z"); // 10:00 KST
  const dates = metricDates(3, now);
  assert.deepEqual(dates, ["2026-09-08", "2026-09-09", "2026-09-10"]);
});

test("kstDate converts a UTC instant just after midnight KST to the KST calendar date", () => {
  // 2026-09-09T15:30:00Z = 2026-09-10T00:30:00+09:00
  assert.equal(kstDate(new Date("2026-09-09T15:30:00.000Z")), "2026-09-10");
});

test("metricHistory returns an empty array for unverified campaigns instead of guessing", () => {
  const c = campaign({ history: [day("2026-09-09")] });
  assert.deepEqual(metricHistory(c, 7, new Date("2026-09-10T01:00:00.000Z")), []);
});

test("metricHistory filters a verified campaign's history down to the requested window", () => {
  const now = new Date("2026-09-10T01:00:00.000Z");
  const c = campaign({
    metricSource: "live",
    history: [day("2026-08-01"), day("2026-09-09"), day("2026-09-10")],
  });
  const result = metricHistory(c, 2, now);
  assert.deepEqual(result.map((d) => d.date), ["2026-09-09", "2026-09-10"]);
});

test("metricSeries sums only verified campaigns and zero-fills days with no verified data", () => {
  const now = new Date("2026-09-10T01:00:00.000Z");
  const verified = campaign({ id: "v1", metricSource: "live", history: [day("2026-09-10", { spend: 2000 })] });
  const demo = campaign({ id: "d1", metricSource: "demo", history: [day("2026-09-10", { spend: 999999 })] });
  const series = metricSeries([verified, demo], 2, "spend", now);
  assert.deepEqual(series, [0, 2000]);
});
