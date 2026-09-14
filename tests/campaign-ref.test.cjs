const { test } = require("node:test");
const assert = require("node:assert/strict");
const { campaignRef, buildCampaignRefMap, resolveCampaignRefs, snapshotsToPromptJson } = require("@/lib/ai/context");

function snapshot(overrides = {}) {
  return {
    id: "camp-seed-001386",
    name: "시드 캠페인 001386 · 기타이 캠페인",
    status: "active",
    objective: "purchase",
    industry: "it_app",
    dailyBudget: 100000,
    ctr: 2,
    cpa: 10000,
    roas: 150,
    spendTrendPercent: 0,
    ...overrides,
  };
}

test("campaignRef is deterministic and purely numeric (safe across machine translation)", () => {
  const ref = campaignRef("camp-seed-001386");
  assert.match(ref, /^#\d+$/);
  assert.equal(campaignRef("camp-seed-001386"), ref);
});

test("the prompt JSON never contains the Korean name, only id and ref", () => {
  const json = snapshotsToPromptJson([snapshot()]);
  assert.doesNotMatch(json, /시드/);
  assert.match(json, /"ref":"#\d+"/);
});

test("resolveCampaignRefs substitutes a ref back into the real Korean name, regardless of what the model/translator produced around it", () => {
  const s = snapshot();
  const ref = campaignRef(s.id);
  const reply = {
    reply: `${ref}의 CPA가 비교적 높아요.`,
    actions: [
      { id: "a1", type: "adjust_budget", label: `${ref} 예산 조정`, description: `${ref}의 예산을 낮춰요.`, riskLevel: "medium" },
    ],
  };
  const resolved = resolveCampaignRefs(reply, [s]);
  assert.equal(resolved.reply, "시드 캠페인 001386 · 기타이 캠페인의 CPA가 비교적 높아요.");
  assert.equal(resolved.actions[0].label, "시드 캠페인 001386 · 기타이 캠페인 예산 조정");
  assert.equal(resolved.actions[0].description, "시드 캠페인 001386 · 기타이 캠페인의 예산을 낮춰요.");
});

test("resolveCampaignRefs also substitutes refs inside quickReplies when present", () => {
  const s = snapshot();
  const ref = campaignRef(s.id);
  const reply = { reply: "어떤 캠페인을 말씀하시는 건가요?", actions: [], quickReplies: [`${ref} 예산 늘려줘`, "새 캠페인 만들기"] };
  const resolved = resolveCampaignRefs(reply, [s]);
  assert.deepEqual(resolved.quickReplies, ["시드 캠페인 001386 · 기타이 캠페인 예산 늘려줘", "새 캠페인 만들기"]);
});

test("resolveCampaignRefs leaves quickReplies out when the reply didn't have any", () => {
  const reply = { reply: "안녕하세요!", actions: [] };
  const resolved = resolveCampaignRefs(reply, [snapshot()]);
  assert.equal(resolved.quickReplies, undefined);
});

test("an unrecognized ref token is left untouched instead of guessed at", () => {
  const reply = { reply: "#99999는 성과가 좋아요.", actions: [] };
  const resolved = resolveCampaignRefs(reply, [snapshot()]);
  assert.equal(resolved.reply, "#99999는 성과가 좋아요.");
});

test("buildCampaignRefMap maps every snapshot's ref to its real name", () => {
  const a = snapshot({ id: "camp-a", name: "A 캠페인" });
  const b = snapshot({ id: "camp-b", name: "B 캠페인" });
  const map = buildCampaignRefMap([a, b]);
  assert.equal(map[campaignRef("camp-a")], "A 캠페인");
  assert.equal(map[campaignRef("camp-b")], "B 캠페인");
});

test("ref depends only on id, not on list order or which other campaigns are present", () => {
  const a = snapshot({ id: "camp-a", name: "A 캠페인" });
  const b = snapshot({ id: "camp-b", name: "B 캠페인" });
  // 이전 턴엔 [a, b] 순서로, 이번 턴엔 컨텍스트 재전송을 생략해 [a]만 보였다고 가정해도
  // 모델이 예전에 배운 a의 ref는 여전히 유효해야 한다.
  assert.equal(buildCampaignRefMap([a, b])[campaignRef(a.id)], buildCampaignRefMap([a])[campaignRef(a.id)]);
  assert.notEqual(campaignRef(a.id), campaignRef(b.id));
});
