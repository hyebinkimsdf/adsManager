const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createCampaignSetupDraft, validateCampaignSetup, defaultCampaignName, planDays, staticBudgetRecommendation } = require("@/lib/campaigns/setup");
const { createCampaignSetup, getCampaignSetupOptions } = require("@/lib/campaigns/setupServer");

test("missing setup schema is distinguished from transient database failures", () => {
  const { isCampaignSetupSchemaError } = require("@/lib/campaigns/setupServer");
  assert.equal(isCampaignSetupSchemaError(new Error("no such table: TrackingConnection")), true);
  assert.equal(isCampaignSetupSchemaError(new Error("no such column: createRequestId")), true);
  assert.equal(isCampaignSetupSchemaError(new Error("network timeout")), false);
});

function setupHook() {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { useCampaignSetup } = require("@/lib/campaigns/useCampaignSetup");
  let hook;
  function Probe() { hook = useCampaignSetup(false); return null; }
  // Exercise the hook's ref-backed submission guard without mounting effects or a browser.
  renderToString(React.createElement(Probe));
  return hook;
}

test("starting fresh from a vague message flags which fields got defaulted, a fully-specified message does not", () => {
  const vague = setupHook();
  const vagueNote = vague.startFromMessage("광고 하나 만들어줘", true);
  assert.match(vagueNote, /기본값을 넣었어요/);
  assert.match(vagueNote, /목표/);
  assert.match(vagueNote, /업종/);
  assert.match(vagueNote, /예산/);

  const specific = setupHook();
  const specificNote = specific.startFromMessage("온라인몰 구매를 늘리고 싶어요, 예산은 50만원으로", true);
  assert.doesNotMatch(specificNote, /기본값을 넣었어요/);

  // A follow-up edit on the same draft should not re-warn about fields it isn't touching.
  const followUpNote = specific.startFromMessage("종료일 없이 계속", false);
  assert.doesNotMatch(followUpNote, /기본값을 넣었어요/);
});

test("unknown save outcome retries the exact payload and blocks intervening edits", async () => {
  const originalFetch = global.fetch;
  const hook = setupHook();
  const sent = [];
  global.fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    throw new Error("connection lost after server may have saved");
  };
  try {
    await hook.submit(true);
    hook.updateDraft({ ...hook.draft, totalBudget: 200000 });
    assert.match(hook.startFromMessage("새 광고 만들어줘", true), /저장 결과/);
    await hook.submit(false);
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[1], sent[0]);
    assert.equal(sent[1].saveAsDraft, true);
  } finally { global.fetch = originalFetch; }
});

test("definitely unsaved rejection allows corrections with the same request id", async () => {
  const originalFetch = global.fetch;
  const hook = setupHook();
  const sent = [];
  global.fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ error: "연결을 확인해 주세요.", outcome: "not_saved" }), { status: 409 });
  };
  try {
    await hook.submit(true);
    hook.updateDraft({ ...hook.draft, totalBudget: 200000 });
    await hook.submit(true);
    assert.equal(sent[1].totalBudget, 200000);
    assert.equal(sent[1].requestId, sent[0].requestId);
  } finally { global.fetch = originalFetch; }
});

test("rapid submit attempts share one in-flight save", async () => {
  const originalFetch = global.fetch;
  const hook = setupHook();
  let finish;
  let calls = 0;
  global.fetch = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  try {
    const first = hook.submit(true);
    await hook.submit(true);
    assert.equal(calls, 1);
    finish(new Response(JSON.stringify({ error: "입력을 확인해 주세요.", outcome: "not_saved" }), { status: 400 }));
    await first;
  } finally { global.fetch = originalFetch; }
});

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(join(__dirname, "../d1/schema.sql"), "utf8"));
  const query = async (sql, params = []) => db.prepare(sql).all(...params);
  return { db, query };
}
function request(patch = {}) {
  return { ...createCampaignSetupDraft(new Date("2026-09-12T16:00:00Z"), "request-123456"), saveAsDraft: true, ...patch };
}
function connect(db, ownerId = "owner-primary", status = "connected", revokedAt = null) {
  db.prepare("INSERT INTO TrackingConnection (id,ownerId,name,siteUrl,status,verifiedAt,revokedAt) VALUES (?,?,?,?,?,?,?)")
    .run("code-1", ownerId, "내 쇼핑몰", "https://example.com", status, "2026-09-01T00:00:00Z", revokedAt);
}

test("static budget fallback scales with days and varies by objective/industry, never below the minimum", () => {
  assert.equal(planDays("2026-09-13", "2026-09-19"), 7);
  assert.equal(planDays("2026-09-13", "2026-09-13"), 1);
  assert.equal(staticBudgetRecommendation("app_install", "finance", 7), 980000); // 100000 * 1.4 * 7
  assert.equal(staticBudgetRecommendation("visit", "food", 1), 100000); // 30000 * 0.8 * 1 = 24000, floored to MIN_TOTAL_BUDGET
  assert.ok(staticBudgetRecommendation("app_install", "etc", 7) > staticBudgetRecommendation("visit", "etc", 7));
  assert.ok(staticBudgetRecommendation("purchase", "finance", 7) > staticBudgetRecommendation("purchase", "food", 7));
});

test("setup default name is assigned in Korea time and empty draft name stays empty", () => {
  assert.equal(defaultCampaignName(new Date("2026-09-12T16:02:03Z")), "캠페인_20260913_010203");
  assert.equal(request().name, "");
  assert.equal(request().startDate, "2026-09-13");
  assert.equal(request().endDate, "2026-09-19");
});

test("setup validates minimum, hundred-won units, safe integers and real calendar dates", () => {
  for (const totalBudget of [99900, 100001, 100000.1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, "100000"]) {
    assert.equal(validateCampaignSetup(request({ totalBudget })).ok, false);
  }
  for (const patch of [{ startDate: "2026-02-30" }, { endDate: "2026-09-12" }, { endDate: undefined }, { objective: "unknown" }, { requestId: "x" }]) {
    assert.equal(validateCampaignSetup(request(patch)).ok, false);
  }
  assert.equal(validateCampaignSetup(request({ endDate: null, totalBudget: 100100 })).ok, true);
  assert.equal(validateCampaignSetup(request({ saveAsDraft: false })).ok, false);
});

test("setup draft stores total budget and dates but never starts delivery or invents performance", async () => {
  const { db, query } = database();
  try {
    const { campaign, created } = await createCampaignSetup(request(), "owner-primary", query, new Date("2026-09-12T16:02:03Z"));
    assert.equal(created, true);
    assert.equal(campaign.name, "캠페인_20260913_010203");
    assert.equal(campaign.status, "paused");
    assert.equal(campaign.metricSource, "unverified");
    assert.deepEqual(campaign.history, []);
    assert.equal(campaign.totalBudget, 100000);
    assert.equal(campaign.setupStatus, "draft");
    assert.equal(campaign.endDate, "2026-09-19");
  } finally { db.close(); }
});

test("same setup request is idempotent across retries and conflicting payload is rejected", async () => {
  const { db, query } = database();
  try {
    const first = await createCampaignSetup(request(), "owner-primary", query, new Date("2026-09-12T16:02:03Z"));
    const retry = await createCampaignSetup(request(), "owner-primary", query, new Date("2026-09-13T16:02:03Z"));
    assert.equal(retry.created, false);
    assert.equal(retry.campaign.id, first.campaign.id);
    assert.equal(retry.campaign.name, first.campaign.name);
    await assert.rejects(createCampaignSetup(request({ totalBudget: 200000 }), "owner-primary", query), { status: 409, outcome: "unknown" });
    const other = await createCampaignSetup(request(), "owner-other", query);
    assert.notEqual(other.campaign.id, first.campaign.id);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM Campaign").get().n, 2);
  } finally { db.close(); }
});

test("concurrent identical setup requests insert only one campaign", async () => {
  const { db, query } = database();
  try {
    const results = await Promise.all([createCampaignSetup(request(), "owner-primary", query), createCampaignSetup(request(), "owner-primary", query)]);
    assert.equal(results[0].campaign.id, results[1].campaign.id);
    assert.equal(results.filter((r) => r.created).length, 1);
  } finally { db.close(); }
});

test("setup accepts only own connected nonrevoked code and still saves paused", async () => {
  for (const [ownerId, status, revokedAt, valid] of [
    ["owner-primary", "connected", null, true], ["someone-else", "connected", null, false],
    ["owner-primary", "pending", null, false], ["owner-primary", "connected", "2026-09-12", false],
  ]) {
    const { db, query } = database();
    try {
      connect(db, ownerId, status, revokedAt);
      const promise = createCampaignSetup(request({ trackingConnectionId: "code-1", saveAsDraft: false }), "owner-primary", query);
      if (valid) {
        const { campaign } = await promise;
        assert.equal(campaign.setupStatus, "configured");
        assert.equal(campaign.status, "paused");
      } else {
        await assert.rejects(promise, { status: 409, outcome: "not_saved" });
        assert.equal(db.prepare("SELECT COUNT(*) n FROM Campaign").get().n, 0);
      }
    } finally { db.close(); }
  }
});

test("connection revocation between options and save is rechecked atomically", async () => {
  const { db, query } = database();
  try {
    connect(db);
    const options = await getCampaignSetupOptions("owner-primary", request(), query, false);
    assert.equal(options.trackingConnections.length, 1);
    db.exec("UPDATE TrackingConnection SET status='revoked'");
    await assert.rejects(createCampaignSetup(request({ trackingConnectionId: "code-1" }), "owner-primary", query), { status: 409 });
  } finally { db.close(); }
});

function cohort(db, owners, perOwner, source = "live") {
  const history = Array.from({ length: 7 }, (_, index) => ({
    date: new Date(Date.now() - (index + 2) * 86400000).toISOString().slice(0, 10), spend: 20000,
  }));
  const insert = db.prepare("INSERT INTO Campaign (id,name,objective,industry,status,dailyBudget,targeting,history,ownerId,metricSource) VALUES (?,?,?,?,?,?,?,?,?,?)");
  for (let owner = 0; owner < owners; owner++) for (let n = 0; n < perOwner; n++) {
    insert.run(`${source}-${owner}-${n}`, "private campaign name", "purchase", "etc", "paused", 20000, "{}", JSON.stringify(history), `owner-${owner}`, source);
  }
}

test("cross-account budget recommendation is opt-in, private and refuses insufficient cohorts or no end date", async () => {
  const { db, query } = database();
  try {
    cohort(db, 5, 4);
    let queryCount = 0;
    const tracked = async (...args) => { queryCount++; return query(...args); };
    const disabled = await getCampaignSetupOptions("owner-primary", request(), tracked, false);
    assert.equal(disabled.budgetRecommendation.source, "static");
    assert.equal(disabled.budgetRecommendation.totalBudget, 490000);
    assert.equal(queryCount, 1, "disabled benchmark does not query other accounts at all");
    const result = await getCampaignSetupOptions("owner-primary", request(), query, true);
    assert.equal(result.budgetRecommendation.totalBudget, 140000);
    assert.equal(result.budgetRecommendation.source, "benchmark");
    assert.equal(JSON.stringify(result).includes("private campaign name"), false);
    assert.equal((await getCampaignSetupOptions("owner-primary", request({ endDate: null }), query, true)).budgetRecommendation.source, "unavailable");
    db.exec("DELETE FROM Campaign WHERE ownerId='owner-4'");
    assert.equal((await getCampaignSetupOptions("owner-primary", request(), query, true)).budgetRecommendation.source, "static");
  } finally { db.close(); }
});

test("demo/unverified, undated and stale history never qualify for cross-account budget recommendations", async () => {
  const { db, query } = database();
  try {
    cohort(db, 5, 4, "demo");
    cohort(db, 5, 4, "unverified");
    assert.equal((await getCampaignSetupOptions("owner-primary", request(), query, true)).budgetRecommendation.source, "static");
    db.exec("UPDATE Campaign SET metricSource='live', history='[{\"spend\":20000}]'");
    assert.equal((await getCampaignSetupOptions("owner-primary", request(), query, true)).budgetRecommendation.source, "static");
    db.exec("UPDATE Campaign SET history='[{\"date\":\"2020-01-01\",\"spend\":20000}]'");
    assert.equal((await getCampaignSetupOptions("owner-primary", request(), query, true)).budgetRecommendation.source, "static");
  } finally { db.close(); }
});

test("setup migration preserves existing campaigns and enforces owner-scoped request uniqueness", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE Campaign (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL); INSERT INTO Campaign VALUES ('old','owner-primary')");
    db.exec(readFileSync(join(__dirname, "../d1/migrations/0004_campaign_setup.sql"), "utf8"));
    assert.equal(db.prepare("SELECT id FROM Campaign").get().id, "old");
    db.exec("INSERT INTO Campaign (id,ownerId,createRequestId) VALUES ('new','owner-primary','request-1')");
    assert.throws(() => db.exec("INSERT INTO Campaign (id,ownerId,createRequestId) VALUES ('duplicate','owner-primary','request-1')"));
    db.exec("INSERT INTO Campaign (id,ownerId,createRequestId) VALUES ('other','owner-other','request-1')");
  } finally { db.close(); }
});

test("setup API independently protects reads and cross-site writes", async () => {
  const { GET, POST } = require("@/app/api/campaigns/setup/route");
  const previous = { ADS_ADMIN_PASSWORD: process.env.ADS_ADMIN_PASSWORD, ADS_ADMIN_USERNAME: process.env.ADS_ADMIN_USERNAME };
  process.env.ADS_ADMIN_PASSWORD = "test-only-secret";
  process.env.ADS_ADMIN_USERNAME = "admin";
  try {
    assert.equal((await GET(new Request("https://ads.example.com/api/campaigns/setup"))).status, 401);
    const response = await POST(new Request("https://ads.example.com/api/campaigns/setup", {
      method: "POST", headers: {
        authorization: `Basic ${Buffer.from("admin:test-only-secret").toString("base64")}`,
        origin: "https://different.example.com",
      },
    }));
    assert.equal(response.status, 403);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
