const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const originalNow = Date.now;
let nowValue = 1_000_000;

beforeEach(() => {
  nowValue = 1_000_000;
  Date.now = () => nowValue;
});

afterEach(() => {
  Date.now = originalNow;
});

// 캐시 모듈이 require 시점에 자기 상태(cached 변수)를 모듈 스코프에 가둬두므로, 매 테스트가
// 서로의 상태를 보지 않도록 매번 새로 require한다(require 캐시를 비워 순수한 초기 상태로 시작).
function freshCache() {
  const path = require.resolve('../lib/campaigns/summaryCache.ts');
  delete require.cache[path];
  return require('../lib/campaigns/summaryCache.ts');
}

test('a fresh cache starts empty', () => {
  const { getCachedSummary } = freshCache();
  assert.equal(getCachedSummary(), null);
});

test('a value set is returned as-is until it expires', () => {
  const { getCachedSummary, setCachedSummary } = freshCache();
  const summary = { totalCampaignCount: 3 };
  setCachedSummary(summary);
  assert.equal(getCachedSummary(), summary);
  nowValue += 9_999; // TTL_MS(10s) 직전 — 아직 유효해야 한다.
  assert.equal(getCachedSummary(), summary);
});

test('a value expires once its TTL has fully elapsed', () => {
  const { getCachedSummary, setCachedSummary } = freshCache();
  setCachedSummary({ totalCampaignCount: 3 });
  nowValue += 10_001; // TTL_MS(10s)를 넘어섬 — 더 이상 신선하지 않다.
  assert.equal(getCachedSummary(), null);
});

test('invalidate clears the cache even before the TTL elapses, so writes are visible immediately', () => {
  const { getCachedSummary, setCachedSummary, invalidateSummaryCache } = freshCache();
  setCachedSummary({ totalCampaignCount: 3 });
  invalidateSummaryCache();
  assert.equal(getCachedSummary(), null);
});

test('setting a new value after invalidation restarts the TTL window', () => {
  const { getCachedSummary, setCachedSummary, invalidateSummaryCache } = freshCache();
  setCachedSummary({ totalCampaignCount: 3 });
  invalidateSummaryCache();
  const updated = { totalCampaignCount: 4 };
  setCachedSummary(updated);
  assert.equal(getCachedSummary(), updated);
});
