const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseMeasurementQuery, getDefaultMeasurementQuery, measurementBounds } = require("@/lib/tracking/measurement");

test("parseMeasurementQuery defaults source to live when not specified", () => {
  const q = parseMeasurementQuery(new URLSearchParams({ start: "2026-09-01", end: "2026-09-10" }));
  assert.equal(q.source, "live");
});

test("parseMeasurementQuery rejects a source outside live/test/legacy", () => {
  assert.throws(() => parseMeasurementQuery(new URLSearchParams({ start: "2026-09-01", end: "2026-09-10", source: "demo" })));
});

test("parseMeasurementQuery rejects an end date before the start date", () => {
  assert.throws(() => parseMeasurementQuery(new URLSearchParams({ start: "2026-09-10", end: "2026-09-01" })));
});

test("parseMeasurementQuery rejects a malformed date", () => {
  assert.throws(() => parseMeasurementQuery(new URLSearchParams({ start: "2026/09/01", end: "2026-09-10" })));
});

test("getDefaultMeasurementQuery spans the last 14 days ending today in Asia/Seoul", () => {
  const now = new Date("2026-09-10T01:00:00.000Z"); // 10:00 KST
  const q = getDefaultMeasurementQuery(now);
  assert.equal(q.end, "2026-09-10");
  assert.equal(q.start, "2026-08-28");
});

test("measurementBounds converts a KST calendar range into a half-open UTC instant range", () => {
  const bounds = measurementBounds({ start: "2026-09-09", end: "2026-09-09", source: "live" });
  assert.equal(bounds.from, "2026-09-08T15:00:00.000Z");
  assert.equal(bounds.until, "2026-09-09T15:00:00.000Z");
});
