const { test } = require("node:test");
const assert = require("node:assert/strict");
const d1 = require("@/lib/d1");
const rules = require("@/app/api/tracking/rules/route");
const events = require("@/app/api/tracking/events/route");

test("tracking rules reports missing storage instead of a successful empty list", async (t) => {
  t.mock.method(d1, "isD1Configured", () => false);
  const response = await rules.GET(new Request("https://example.com/api/tracking/rules?campaignId=abc"));
  assert.equal(response.status, 503);
  assert.equal(typeof (await response.json()).error, "string");
});

test("tracking rules distinguishes query failure from no saved rules", async (t) => {
  t.mock.method(d1, "isD1Configured", () => true);
  const query = t.mock.method(d1, "d1Query", async () => { throw new Error("database unavailable"); });
  const request = new Request("https://example.com/api/tracking/rules?campaignId=abc");
  assert.equal((await rules.GET(request)).status, 503);
  query.mock.mockImplementation(async () => []);
  const empty = await rules.GET(request);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), []);
});

test("loading an empty event list never seeds demo rows or writes to storage", async (t) => {
  t.mock.method(d1, "isD1Configured", () => true);
  const queries = [];
  t.mock.method(d1, "d1Query", async (sql) => {
    queries.push(sql);
    if (sql.startsWith("PRAGMA")) return ["source", "eventId", "orderId"].map((name) => ({ name }));
    return [];
  });
  const response = await events.GET(new Request("https://example.com/api/tracking/events"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.ok(queries.every((sql) => /^(SELECT|PRAGMA)\b/.test(sql)));
  assert.equal(queries.length, 2);
});
