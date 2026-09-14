const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isPlainGreeting } = require("@/lib/ai/greeting");

test("isPlainGreeting recognizes common greetings", () => {
  assert.equal(isPlainGreeting("안녕"), true);
  assert.equal(isPlainGreeting("안녕하세요"), true);
  assert.equal(isPlainGreeting("안녕하세요!"), true);
  assert.equal(isPlainGreeting("하이"), true);
  assert.equal(isPlainGreeting("hello"), true);
  assert.equal(isPlainGreeting("반가워요"), true);
});

test("isPlainGreeting ignores messages that only start with a greeting", () => {
  assert.equal(isPlainGreeting("안녕, 이번 주 성과 어때?"), false);
  assert.equal(isPlainGreeting("안녕하세요 예산 늘려줘"), false);
});

test("isPlainGreeting ignores unrelated chat messages", () => {
  assert.equal(isPlainGreeting("이번 주 성과 어때?"), false);
  assert.equal(isPlainGreeting("예산 늘려줘"), false);
});
