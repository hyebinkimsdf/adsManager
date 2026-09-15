const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildWeeklyRecommendations, hasAppliedFixPending, composeWeeklySummary } = require("@/lib/insights");

const NOW = new Date("2026-09-14T09:00:00.000Z");
const DAY_MS = 86_400_000;

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

// 최근 7일간 지출은 있지만 전환이 거의 없어 ROAS가 낮은(150 미만) 실적 — lower_budget 후보 조건.
function poorLast7Days(count = 7) {
  return Array.from({ length: count }, (_, i) => ({
    label: `D-${count - 1 - i}`,
    spend: 10000,
    impressions: 1000,
    clicks: 50,
    conversions: 0,
    revenue: 0,
  }));
}

test("a struggling campaign with no recent budget change gets the lower_budget recommendation", () => {
  const c = campaign({ history: poorLast7Days() });
  const recs = buildWeeklyRecommendations([c], NOW);
  assert.ok(recs.some((r) => r.kind === "lower_budget" && r.campaignId === "camp-1"));
});

test("a campaign whose budget was just adjusted is NOT re-recommended, but shows why instead of vanishing silently", () => {
  const c = campaign({
    history: poorLast7Days(),
    lastBudgetAdjustmentAt: new Date(NOW.getTime() - 1 * DAY_MS).toISOString(), // 1일 전 조정
  });
  const recs = buildWeeklyRecommendations([c], NOW);
  assert.ok(!recs.some((r) => r.kind === "lower_budget" || r.kind === "raise_budget"));
  const observing = recs.find((r) => r.kind === "observing");
  assert.ok(observing, "cooling down should surface an observing notice, not silence");
  assert.equal(observing.campaignId, "camp-1");
  assert.match(observing.detail, /관찰 중/);
  assert.match(observing.detail, /2일 후/); // 3일 쿨다운 - 1일 경과 = 2일 남음
});

test("the cooldown expires after BUDGET_COOLDOWN_DAYS and the recommendation can reappear", () => {
  const c = campaign({
    history: poorLast7Days(),
    lastBudgetAdjustmentAt: new Date(NOW.getTime() - 4 * DAY_MS).toISOString(), // 4일 전(쿨다운 3일 지남)
  });
  const recs = buildWeeklyRecommendations([c], NOW);
  assert.ok(recs.some((r) => r.kind === "lower_budget" && r.campaignId === "camp-1"));
});

test("a recently budget-adjusted campaign can still be picked for focus_target (unrelated to budget)", () => {
  const c = campaign({
    history: Array.from({ length: 7 }, (_, i) => ({
      label: `D-${6 - i}`,
      spend: 10000,
      impressions: 1000,
      clicks: 200,
      conversions: 20,
      revenue: 400000,
    })),
    lastBudgetAdjustmentAt: new Date(NOW.getTime() - 1 * DAY_MS).toISOString(),
  });
  const recs = buildWeeklyRecommendations([c], NOW);
  assert.ok(recs.some((r) => r.kind === "focus_target" && r.campaignId === "camp-1"));
});

test("when the single worst campaign is cooling down, a less-bad campaign is NOT promoted to fill its slot", () => {
  // 두 캠페인 다 똑같이 나쁘면(roas 동률) "진짜 최악"인 cooling을 관찰 중으로 알리고, fresh를
  // 대신 추천하지 않는다 — "왜 더 나은 캠페인 말고 저기를 추천하지?" 같은 혼란을 막기 위함.
  const cooling = campaign({ id: "camp-cooling", history: poorLast7Days(), lastBudgetAdjustmentAt: NOW.toISOString() });
  const fresh = campaign({ id: "camp-fresh", history: poorLast7Days() });
  const recs = buildWeeklyRecommendations([cooling, fresh], NOW);
  assert.equal(recs.filter((r) => r.kind === "lower_budget").length, 0);
  const observing = recs.find((r) => r.kind === "observing");
  assert.equal(observing?.campaignId, "camp-cooling");
});

function liveDay(date, overrides = {}) {
  return { label: date, date, spend: 10000, impressions: 1000, clicks: 50, conversions: 0, revenue: 0, ...overrides };
}

test("for a live campaign, the cooldown is judged by days of new dated data, not wall-clock time", () => {
  const dates = ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"];
  const stillWaiting = campaign({
    metricSource: "live",
    history: dates.map((d) => liveDay(d)),
    lastBudgetAdjustmentAt: "2026-09-13T09:00:00.000Z", // 09-13 이후로는 09-14 하루치만 새로 쌓임
  });
  const waitingRecs = buildWeeklyRecommendations([stillWaiting], NOW);
  assert.ok(!waitingRecs.some((r) => r.kind === "lower_budget"));
  const notice = waitingRecs.find((r) => r.kind === "observing");
  assert.match(notice.detail, /새 데이터가 2일 더 쌓이면/); // 3일 필요 - 1일 확보 = 2일 남음

  const enoughNewData = campaign({
    metricSource: "live",
    history: dates.map((d) => liveDay(d)),
    lastBudgetAdjustmentAt: "2026-09-11T09:00:00.000Z", // 09-11 이후로 09-12/13/14 사흘치가 새로 쌓임
  });
  const readyRecs = buildWeeklyRecommendations([enoughNewData], NOW);
  assert.ok(readyRecs.some((r) => r.kind === "lower_budget" && r.campaignId === "camp-1"));
});

test("an observing notice for the worst campaign carries tone 'warning', so the dashboard badge can tell it apart from a raise_budget cooldown", () => {
  const c = campaign({
    history: poorLast7Days(),
    lastBudgetAdjustmentAt: new Date(NOW.getTime() - 1 * DAY_MS).toISOString(),
  });
  const recs = buildWeeklyRecommendations([c], NOW);
  const observing = recs.find((r) => r.kind === "observing");
  assert.equal(observing.tone, "warning");
  assert.equal(hasAppliedFixPending(recs), true);
});

test("an observing notice for a top (raise_budget) campaign carries tone 'positive', not 'warning'", () => {
  const c = campaign({
    history: Array.from({ length: 7 }, (_, i) => ({
      label: `D-${6 - i}`,
      spend: 10000,
      impressions: 1000,
      clicks: 200,
      conversions: 20,
      revenue: 20000, // roas 200% — raise_budget territory, not lower_budget
    })),
    lastBudgetAdjustmentAt: NOW.toISOString(),
  });
  const recs = buildWeeklyRecommendations([c], NOW);
  const observing = recs.find((r) => r.kind === "observing");
  assert.equal(observing.tone, "positive");
  // 문의 감소와 무관한(오히려 잘 되던 캠페인의) 관찰 항목이라 "이미 조치했다"는 신호로 쓰면 안 된다.
  assert.equal(hasAppliedFixPending(recs), false);
});

test("hasAppliedFixPending is false when nothing is cooling", () => {
  const c = campaign({ history: poorLast7Days() });
  const recs = buildWeeklyRecommendations([c], NOW);
  assert.equal(hasAppliedFixPending(recs), false);
});

test("composeWeeklySummary softens the badge to 'observing' once the fix is already applied", () => {
  const stillNagging = composeWeeklySummary(-2, -15, false);
  assert.equal(stillNagging.status, "attention");
  assert.equal(stillNagging.badge, "점검이 필요해요");

  const alreadyFixed = composeWeeklySummary(-2, -15, true);
  assert.equal(alreadyFixed.status, "observing");
  assert.equal(alreadyFixed.badge, "수정 후 관찰중");
  // 문의가 줄었다는 사실 자체는 숨기지 않는다 — 조치했다는 맥락만 덧붙인다.
  assert.match(alreadyFixed.headline, /15%/);
});

test("composeWeeklySummary ignores fixApplied when the trend isn't actually bad", () => {
  const healthy = composeWeeklySummary(0, 20, true);
  assert.equal(healthy.status, "healthy");
});

test("with two struggling campaigns where only the milder one is cooling down, the true worst still gets recommended", () => {
  // roas 0%(revenue 없음) — milderCooling(roas 30%)보다 확정적으로 더 나쁘다. 배열 순서가 아니라
  // 실제 roas 차이로 "최악"이 갈린다는 걸 확인한다(둘 다 roas가 같으면 순서에만 의존하게 된다).
  const worse = campaign({ id: "camp-worse", history: poorLast7Days() });
  const milderCooling = campaign({
    id: "camp-milder-cooling",
    history: poorLast7Days().map((d) => ({ ...d, conversions: 1, revenue: 3000 })), // roas 30%
    lastBudgetAdjustmentAt: NOW.toISOString(),
  });
  const recs = buildWeeklyRecommendations([milderCooling, worse], NOW); // milderCooling을 먼저 둬서 순서 의존이 아님을 확인
  const lowerBudget = recs.find((r) => r.kind === "lower_budget");
  assert.equal(lowerBudget?.campaignId, "camp-worse");
  assert.ok(!recs.some((r) => r.kind === "observing"), "milderCooling never qualified as the top candidate, so no notice for it either");
});
