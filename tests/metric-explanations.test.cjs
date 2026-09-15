const { test } = require("node:test");
const assert = require("node:assert/strict");
const { explainSpend, explainRoas, explainCtr, explainCpa } = require("@/lib/campaigns/metricExplanations");

test("explainSpend is always a neutral, factual caption", () => {
  const result = explainSpend();
  assert.equal(result.tone, "neutral");
  assert.match(result.caption, /광고비/);
});

test("explainRoas reports neutral when there is no spend yet", () => {
  const result = explainRoas(0, 0);
  assert.equal(result.tone, "neutral");
});

test("explainRoas classifies good/okay/bad using the same thresholds as the weekly recommendation buckets", () => {
  assert.equal(explainRoas(250, 1000).tone, "good");
  assert.equal(explainRoas(300, 1000).tone, "good");
  assert.equal(explainRoas(120, 1000).tone, "okay");
  assert.equal(explainRoas(200, 1000).tone, "okay");
  assert.equal(explainRoas(119, 1000).tone, "bad");
  assert.equal(explainRoas(0, 1000).tone, "bad"); // 지출은 있었지만 매출로 이어지지 않은 손실 상태
});

test("explainRoas translates the percentage into a plain-language multiple", () => {
  const result = explainRoas(317, 950000);
  assert.match(result.caption, /3\.2배/);
});

test("explainCtr reports neutral when there are no impressions yet", () => {
  assert.equal(explainCtr(0, 0).tone, "neutral");
});

test("explainCtr classifies good/okay/bad and expresses the rate per 1,000 impressions", () => {
  const good = explainCtr(2.09, 1000);
  assert.equal(good.tone, "good");
  assert.match(good.caption, /1,000명 중 약 21명/);

  assert.equal(explainCtr(0.5, 1000).tone, "okay");
  assert.equal(explainCtr(0.1, 1000).tone, "bad");
});

test("explainCpa reports neutral when there are no conversions yet, regardless of ROAS tone", () => {
  const result = explainCpa(0, 0, "good");
  assert.equal(result.tone, "neutral");
});

test("explainCpa borrows the ROAS tone instead of judging the amount on its own", () => {
  const result = explainCpa(12345, 3, "bad");
  assert.equal(result.tone, "bad");
  assert.match(result.caption, /12,345원/);
});
