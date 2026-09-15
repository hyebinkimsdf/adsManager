const { test } = require("node:test");
const assert = require("node:assert/strict");
const { OnDeviceAiRuntime } = require("@/lib/ai/onDeviceAiRuntime");
const { runOnDeviceRequest } = require("@/lib/ai/onDeviceAiRequest");
const { ON_DEVICE_AI_PROMPTS } = require("@/lib/ai/onDeviceAiPrompts");
const { BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN, buildBudgetRecommendationUserTurnEn } = require("@/lib/ai/budgetRecommendationPrompt");
const { BUDGET_RECOMMENDATION_RESPONSE_SCHEMA_EN, isBudgetRecommendationReply } = require("@/lib/ai/budgetRecommendationSchema");

const prompts = ["chat system prompt", "campaign system prompt"];
const tick = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function session() {
  return { destroyed: 0, destroy() { this.destroyed += 1; } };
}

function setup(t, { availability = "available", create, translatorAvailability, systemPrompts = prompts } = {}) {
  const calls = [];
  const originalWindow = global.window;
  const runtime = new OnDeviceAiRuntime(systemPrompts);
  const make = (key, options) => {
    const monitor = new EventTarget();
    options.monitor?.(monitor);
    const call = { key, options, monitor, value: session() };
    calls.push(call);
    return create ? create(call, calls) : Promise.resolve(call.value);
  };
  global.window = {
    LanguageModel: {
      availability: async () => availability,
      create: (options) => make(options.initialPrompts[0].content, options),
    },
    Translator: {
      availability: translatorAvailability ?? (async () => availability),
      create: (options) => make(`${options.sourceLanguage}-${options.targetLanguage}`, options),
    },
  };
  t.mock.method(console, "warn", () => {});
  t.mock.method(console, "info", () => {});
  t.after(() => {
    runtime.dispose();
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  });
  return { runtime, calls };
}

function progress(call, loaded) {
  const event = new Event("downloadprogress");
  event.loaded = loaded;
  call.monitor.dispatchEvent(event);
}

test("homepage prewarms only chat and shared translators even after user gestures", async (t) => {
  const { runtime, calls } = setup(t);
  const states = [];
  const unsubscribe = runtime.subscribe(() => states.push(runtime.getSnapshot().state));
  await runtime.start();
  await tick();
  assert.equal(runtime.getSnapshot().state, "available");
  assert.ok(states.includes("initializing"));
  assert.equal(calls.length, 3);
  assert.equal(runtime.getFeatureStatus(prompts[0]).state, "available");
  assert.equal(runtime.getFeatureStatus(prompts[0]).active, true);
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "idle");
  assert.equal(runtime.getFeatureStatus(prompts[1]).active, false);
  assert.equal(runtime.getSession(prompts[1]), null);
  assert.equal(runtime.getSession("unknown"), null);
  assert.equal(runtime.getTranslators().toEn, calls.find((call) => call.key === "ko-en").value);
  assert.equal(runtime.getTranslators().toKo, calls.find((call) => call.key === "en-ko").value);
  assert.equal(await runtime.prepare(), true);
  await runtime.start();
  runtime.retryStalled();
  await tick();
  assert.equal(calls.length, 3);
  unsubscribe();
  const count = states.length;
  runtime.dispose();
  await runtime.start();
  assert.equal(states.length, count);
});

test("concurrent preparation shares pending creates and awaits actual readiness", async (t) => {
  const gate = deferred();
  const { runtime, calls } = setup(t, { create: (call) => gate.promise.then(() => call.value) });
  const started = runtime.start();
  const first = runtime.prepare();
  const second = runtime.prepare();
  let joinedStartResolved = false;
  const joinedStart = runtime.start().then(() => { joinedStartResolved = true; });
  await tick();
  assert.equal(calls.length, 3);
  assert.equal(joinedStartResolved, false);
  assert.equal(runtime.getSnapshot().state, "initializing");
  assert.equal(runtime.getSession(prompts[0]), null);
  gate.resolve();
  await started;
  await joinedStart;
  await tick();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(calls.length, 3);
});

for (const [name, expectedState] of [["NotAllowedError", "downloadable"], ["OperationError", "error"]]) {
  test(`${name} permits retry without recreating already prepared resources`, async (t) => {
    let denied = true;
    const { runtime, calls } = setup(t, {
      availability: "downloadable",
      create: async (call) => {
        if (call.key === "en-ko" && denied) throw new DOMException("not ready", name);
        return call.value;
      },
    });
    await runtime.start();
    assert.equal(runtime.getSnapshot().state, expectedState);
    assert.equal(runtime.getTranslators(), null);
    const chat = runtime.getSession(prompts[0]);
    assert.ok(chat);
    denied = false;
    assert.equal(await runtime.prepare(), true);
    await tick();
    assert.equal(runtime.getSnapshot().state, "available");
    assert.equal(calls.length, 4);
    assert.equal(calls.filter((call) => call.key === "en-ko").length, 2);
    assert.equal(runtime.getSession(prompts[0]), chat);
    assert.ok(runtime.getTranslators());
  });
}

test("download progress is per resource and 100 percent still waits for initialization", async (t) => {
  const gate = deferred();
  const { runtime, calls } = setup(t, {
    availability: "downloadable",
    create: (call) => gate.promise.then(() => call.value),
  });
  const started = runtime.start();
  await tick();
  progress(calls[0], 0.5);
  assert.equal(runtime.getSnapshot().state, "downloading");
  assert.equal(runtime.getSnapshot().resources[0].progress, 50);
  assert.equal(runtime.getSnapshot().resources[1].progress, 0);
  for (const call of calls) progress(call, 1);
  assert.equal(runtime.getSnapshot().downloadProgress, 100);
  assert.equal(runtime.getSnapshot().state, "initializing");
  assert.equal(runtime.getSession(prompts[0]), null);
  gate.resolve();
  await started;
  assert.equal(runtime.getSnapshot().state, "available");
});

test("an unsupported language pair prevents model and translator creation", async (t) => {
  const { runtime, calls } = setup(t, {
    translatorAvailability: async ({ sourceLanguage }) => sourceLanguage === "ko" ? "unavailable" : "available",
  });
  await runtime.start();
  assert.equal(runtime.getSnapshot().state, "unsupported");
  assert.equal(await runtime.prepare(), false);
  assert.equal(calls.length, 0);
});

test("missing browser APIs are unsupported", async (t) => {
  const { runtime, calls } = setup(t);
  delete global.window.Translator;
  await runtime.start();
  assert.equal(runtime.getSnapshot().state, "unsupported");
  assert.equal(calls.length, 0);
});

test("dispose aborts pending creation and destroys late results without publishing", async (t) => {
  const gate = deferred();
  const { runtime, calls } = setup(t, { create: (call) => gate.promise.then(() => call.value) });
  let publications = 0;
  runtime.subscribe(() => { publications += 1; });
  const started = runtime.start();
  await tick();
  runtime.dispose();
  const count = publications;
  assert.ok(calls.every((call) => call.options.signal.aborted));
  for (const call of calls) progress(call, 1);
  gate.resolve();
  await started;
  assert.equal(publications, count);
  assert.ok(calls.every((call) => call.value.destroyed === 1));
  assert.equal(runtime.getSession(prompts[0]), null);
  assert.equal(runtime.getTranslators(), null);
});

test("dispose and restart isolate late old results from the new runtime lifetime", async (t) => {
  const oldGate = deferred();
  let oldLifetime = true;
  const { runtime, calls } = setup(t, {
    create: (call) => oldLifetime ? oldGate.promise.then(() => call.value) : Promise.resolve(call.value),
  });
  const oldStart = runtime.start();
  await tick();
  const oldCalls = calls.slice();
  runtime.dispose();
  oldLifetime = false;
  await runtime.start();
  await tick();
  const newChat = runtime.getSession(prompts[0]);
  const readySnapshot = runtime.getSnapshot();
  oldGate.resolve();
  await oldStart;
  for (const call of oldCalls) progress(call, 0.1);
  assert.equal(runtime.getSnapshot(), readySnapshot);
  assert.equal(runtime.getSession(prompts[0]), newChat);
  assert.ok(oldCalls.every((call) => call.value.destroyed === 1));
  assert.ok(calls.slice(oldCalls.length).every((call) => call.value.destroyed === 0));
  runtime.dispose();
  assert.ok(calls.every((call) => call.value.destroyed === 1));
});

test("late availability from a disposed lifetime cannot overwrite restarted readiness", async (t) => {
  const oldAvailability = deferred();
  const { runtime, calls } = setup(t);
  global.window.LanguageModel.availability = () => oldAvailability.promise;
  const oldStart = runtime.start();
  runtime.dispose();
  global.window.LanguageModel.availability = async () => "available";
  await runtime.start();
  await tick();
  const readySnapshot = runtime.getSnapshot();
  assert.equal(readySnapshot.state, "available");
  oldAvailability.resolve("unavailable");
  await oldStart;
  assert.equal(runtime.getSnapshot(), readySnapshot);
  assert.equal(calls.length, 3);
});

test("route feature failures do not block already ready chat", async (t) => {
  const background = deferred();
  const { runtime, calls } = setup(t, {
    create: (call) => call.key === prompts[1]
      ? background.promise.then(() => { throw new DOMException("feature failed", "OperationError"); })
      : Promise.resolve(call.value),
  });
  await runtime.start();
  runtime.setActiveFeature(prompts[1]);
  await tick();
  assert.equal(runtime.getSnapshot().state, "available");
  assert.equal(runtime.getFeatureStatus(prompts[0]).state, "available");
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "initializing");
  assert.ok(runtime.getSession(prompts[0]));
  assert.equal(runtime.getSession(prompts[1]), null);
  assert.equal(await runtime.prepare(), true);
  background.resolve();
  await tick();
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "error");
  assert.equal(runtime.getSnapshot().state, "available");
  assert.equal(await runtime.waitForFeature(prompts[0]), true);
  assert.equal(calls.filter((call) => call.key === prompts[1]).length, 1);
});

test("route warmup creates only the selected feature and reuses shared translators", async (t) => {
  const thirdPrompt = "tracking system prompt";
  const chatGate = deferred();
  const { runtime, calls } = setup(t, {
    systemPrompts: [...prompts, thirdPrompt],
    create: (call) => call.key === prompts[0] ? chatGate.promise.then(() => call.value) : Promise.resolve(call.value),
  });
  const started = runtime.start();
  await tick();
  assert.deepEqual(calls.map((call) => call.key).sort(), [prompts[0], "ko-en", "en-ko"].sort());
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "idle");
  assert.equal(runtime.getFeatureStatus(thirdPrompt).state, "idle");
  chatGate.resolve();
  await started;
  await tick();
  assert.equal(calls.length, 3);
  runtime.setActiveFeature(prompts[1]);
  await tick();
  assert.equal(calls.filter((call) => call.key === prompts[1]).length, 1);
  assert.equal(calls.filter((call) => call.key === thirdPrompt).length, 0);
  assert.equal(calls.filter((call) => call.key === "ko-en").length, 1);
  assert.equal(calls.filter((call) => call.key === "en-ko").length, 1);
  assert.equal(runtime.getSnapshot().state, "available");
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "available");
  assert.equal(runtime.getFeatureStatus(prompts[1]).active, true);
  assert.equal(runtime.getFeatureStatus(thirdPrompt).state, "idle");
  assert.equal(runtime.getFeatureStatus(thirdPrompt).active, false);
});

test("direct route warmup during availability checking does not wait for chat readiness", async (t) => {
  const availabilityGate = deferred();
  const chatGate = deferred();
  const { runtime, calls } = setup(t, {
    create: (call) => call.key === prompts[0] ? chatGate.promise.then(() => call.value) : Promise.resolve(call.value),
  });
  global.window.LanguageModel.availability = () => availabilityGate.promise;
  const started = runtime.start();
  runtime.setActiveFeature(prompts[1]);
  assert.equal(runtime.getFeatureStatus(prompts[1]).active, true);
  assert.equal(calls.length, 0);
  availabilityGate.resolve("available");
  await tick();
  assert.equal(runtime.getFeatureStatus(prompts[0]).state, "initializing");
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "available");
  assert.equal(calls.length, 4);
  chatGate.resolve();
  await started;
});

test("leaving a route during availability checking skips its queued warmup", async (t) => {
  const availabilityGate = deferred();
  const { runtime, calls } = setup(t);
  global.window.LanguageModel.availability = () => availabilityGate.promise;
  const started = runtime.start();
  runtime.setActiveFeature(prompts[1]);
  runtime.setActiveFeature(null);
  availabilityGate.resolve("available");
  await started;
  await tick();
  assert.equal(calls.length, 3);
  assert.equal(runtime.getSession(prompts[1]), null);
  assert.equal(runtime.getFeatureStatus(prompts[1]).active, false);
});

test("route transitions retain reusable baselines and repeated route updates are idempotent", async (t) => {
  const thirdPrompt = "tracking system prompt";
  const { runtime, calls } = setup(t, { systemPrompts: [...prompts, thirdPrompt] });
  await runtime.start();
  runtime.setActiveFeature(prompts[1]);
  await tick();
  const campaign = runtime.getSession(prompts[1]);
  assert.ok(campaign);
  const snapshot = runtime.getSnapshot();
  runtime.setActiveFeature(prompts[1]);
  assert.equal(runtime.getSnapshot(), snapshot);
  runtime.setActiveFeature(thirdPrompt);
  await tick();
  assert.equal(runtime.getFeatureStatus(prompts[1]).active, false);
  assert.equal(runtime.getFeatureStatus(thirdPrompt).active, true);
  const tracking = runtime.getSession(thirdPrompt);
  assert.ok(tracking);
  runtime.setActiveFeature(null);
  assert.deepEqual(runtime.getSnapshot().features.map((feature) => feature.active), [true, false, false]);
  runtime.setActiveFeature(prompts[1]);
  await tick();
  assert.equal(runtime.getSession(prompts[1]), campaign);
  assert.equal(runtime.getSession(thirdPrompt), tracking);
  assert.equal(campaign.destroyed, 0);
  assert.equal(tracking.destroyed, 0);
  assert.equal(calls.length, 5);
});

test("activation retries a denied shared translator even when active models are already ready", async (t) => {
  const thirdPrompt = "tracking system prompt";
  let allowed = false;
  const { runtime, calls } = setup(t, {
    systemPrompts: [...prompts, thirdPrompt],
    create: async (call) => {
      if (call.key === "en-ko" && !allowed) throw new DOMException("needs activation", "NotAllowedError");
      return call.value;
    },
  });
  await runtime.start();
  runtime.setActiveFeature(prompts[1]);
  await tick();
  assert.ok(runtime.getSession(prompts[0]));
  assert.ok(runtime.getSession(prompts[1]));
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "downloadable");
  const beforeRetry = calls.length;
  allowed = true;
  runtime.retryStalled();
  runtime.retryStalled();
  await tick();
  assert.equal(calls.length, beforeRetry + 1);
  assert.equal(runtime.getFeatureStatus(prompts[0]).state, "available");
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "available");
  assert.ok(runtime.getTranslators());
  assert.equal(calls.filter((call) => call.key === thirdPrompt).length, 0);
});

test("activation retries only chat and the current route, not a denied feature after leaving it", async (t) => {
  const thirdPrompt = "tracking system prompt";
  let allowed = false;
  const { runtime, calls } = setup(t, {
    availability: "downloadable",
    systemPrompts: [...prompts, thirdPrompt],
    create: async (call) => {
      if (call.key === prompts[1] && !allowed) throw new DOMException("needs activation", "NotAllowedError");
      return call.value;
    },
  });
  await runtime.start();
  runtime.setActiveFeature(prompts[1]);
  await tick();
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "downloadable");
  runtime.setActiveFeature(null);
  allowed = true;
  runtime.retryStalled();
  await tick();
  assert.equal(calls.filter((call) => call.key === prompts[1]).length, 1);
  assert.equal(calls.filter((call) => call.key === thirdPrompt).length, 0);
  assert.equal(runtime.getFeatureStatus(prompts[1]).active, false);
  runtime.setActiveFeature(prompts[1]);
  await tick();
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "available");
  assert.equal(calls.filter((call) => call.key === prompts[1]).length, 2);
});

test("explicit feature requests do not await chat and share translator creation", async (t) => {
  const thirdPrompt = "tracking system prompt";
  const gate = deferred();
  const { runtime, calls } = setup(t, {
    systemPrompts: [...prompts, thirdPrompt],
    create: (call) => gate.promise.then(() => call.value),
  });
  const started = runtime.start();
  await tick();
  const first = runtime.prepareFeature(thirdPrompt, "request");
  const joined = runtime.prepareFeature(thirdPrompt, "request");
  await tick();
  assert.equal(calls.filter((call) => call.key === thirdPrompt).length, 1);
  assert.equal(calls.filter((call) => call.key === prompts[1]).length, 0);
  assert.equal(calls.filter((call) => call.key === "ko-en").length, 1);
  assert.equal(calls.filter((call) => call.key === "en-ko").length, 1);
  gate.resolve();
  assert.deepEqual(await Promise.all([first, joined]), [true, true]);
  await started;
  await tick();
  assert.equal(calls.length, 4);
});

test("retrying one failed feature preserves ready chat and translators", async (t) => {
  let fail = true;
  const { runtime, calls } = setup(t, {
    create: async (call) => {
      if (call.key === prompts[1] && fail) throw new DOMException("retry later", "OperationError");
      return call.value;
    },
  });
  await runtime.start();
  assert.equal(await runtime.prepareFeature(prompts[1]), false);
  const chat = runtime.getSession(prompts[0]);
  const translators = runtime.getTranslators();
  assert.equal(runtime.getFeatureStatus(prompts[1]).state, "error");
  fail = false;
  assert.equal(await runtime.prepareFeature(prompts[1]), true);
  assert.equal(runtime.getSession(prompts[0]), chat);
  assert.equal(runtime.getTranslators().toEn, translators.toEn);
  assert.equal(runtime.getTranslators().toKo, translators.toKo);
  assert.equal(calls.filter((call) => call.key === prompts[1]).length, 2);
  assert.equal(calls.length, 5);
});

test("timed-out and aborted feature waits leave shared feature preparation alive", async (t) => {
  const gate = deferred();
  const { runtime, calls } = setup(t, {
    create: (call) => call.key === prompts[1] ? gate.promise.then(() => call.value) : Promise.resolve(call.value),
  });
  await runtime.start();
  await tick();
  assert.equal(await runtime.waitForFeature(prompts[1], { timeoutMs: 5 }), false);
  const controller = new AbortController();
  const waiting = runtime.waitForFeature(prompts[1], { signal: controller.signal, timeoutMs: 1000 });
  controller.abort();
  assert.equal(await waiting, false);
  const background = calls.find((call) => call.key === prompts[1]);
  assert.equal(background.options.signal.aborted, false);
  assert.equal(background.value.destroyed, 0);
  gate.resolve();
  await tick();
  assert.equal(await runtime.waitForFeature(prompts[1]), true);
  assert.equal(calls.filter((call) => call.key === prompts[1]).length, 1);
});

test("task sessions clone an unmodified baseline for independent requests", async (t) => {
  const { runtime, calls } = setup(t);
  await runtime.start();
  await runtime.prepareFeature(prompts[1]);
  const baseline = runtime.getSession(prompts[1]);
  const clones = [];
  baseline.clone = async () => {
    const copy = session();
    copy.history = [];
    copy.prompt = async (value) => { copy.history.push(value); };
    clones.push(copy);
    return copy;
  };
  baseline.prompt = () => assert.fail("baseline must not receive task prompts");
  const first = await runtime.createTaskSession(prompts[1], new AbortController().signal);
  await first.prompt("first campaign");
  runtime.releaseTaskSession(first);
  const second = await runtime.createTaskSession(prompts[1], new AbortController().signal);
  assert.notEqual(first, second);
  assert.notEqual(second, baseline);
  assert.deepEqual(second.history, []);
  assert.equal(baseline.destroyed, 0);
  assert.equal(clones.length, 2);
  assert.equal(calls.length, 4);
  runtime.releaseTaskSession(second);
  runtime.releaseTaskSession(second);
  assert.equal(first.destroyed, 1);
  assert.equal(second.destroyed, 1);
});

test("task creation without clone uses a fresh system-prompt session", async (t) => {
  const { runtime, calls } = setup(t);
  await runtime.start();
  await runtime.prepareFeature(prompts[1]);
  const baseline = runtime.getSession(prompts[1]);
  const task = await runtime.createTaskSession(prompts[1], new AbortController().signal);
  assert.notEqual(task, baseline);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls[4].options.initialPrompts, [{ role: "system", content: prompts[1] }]);
  assert.equal(runtime.getSession(prompts[1]), baseline);
  runtime.releaseTaskSession(task);
});

test("abort and runtime disposal release live task clones without double destruction", async (t) => {
  const { runtime } = setup(t);
  await runtime.start();
  await runtime.prepareFeature(prompts[1]);
  runtime.getSession(prompts[1]).clone = async () => session();
  const controller = new AbortController();
  const abortedTask = await runtime.createTaskSession(prompts[1], controller.signal);
  const disposedTask = await runtime.createTaskSession(prompts[1], new AbortController().signal);
  controller.abort();
  assert.equal(abortedTask.destroyed, 1);
  assert.equal(disposedTask.destroyed, 0);
  runtime.releaseTaskSession(abortedTask);
  runtime.dispose();
  runtime.releaseTaskSession(disposedTask);
  assert.equal(abortedTask.destroyed, 1);
  assert.equal(disposedTask.destroyed, 1);
});

for (const reason of ["abort", "dispose and restart"]) {
  test(`late task clone is destroyed after ${reason}`, async (t) => {
    const { runtime } = setup(t);
    await runtime.start();
    await runtime.prepareFeature(prompts[1]);
    const gate = deferred();
    const copy = session();
    runtime.getSession(prompts[1]).clone = () => gate.promise.then(() => copy);
    const controller = new AbortController();
    const task = runtime.createTaskSession(prompts[1], controller.signal);
    await tick();
    if (reason === "abort") controller.abort();
    else {
      runtime.dispose();
      await runtime.start();
      await runtime.prepareFeature(prompts[1]);
    }
    gate.resolve();
    assert.equal(await task, null);
    // 정리(destroy)는 별도의 promise 체인이라 호출자의 대기가 끝난 뒤 한 틱 늦게 끝날 수 있다.
    await tick();
    assert.equal(copy.destroyed, 1);
    assert.equal(runtime.getSnapshot().state, "available");
    assert.equal(runtime.getSession(prompts[1]).destroyed, 0);
  });
}

test("preparing a non-chat feature never wakes unvisited features", async (t) => {
  const thirdPrompt = "tracking system prompt";
  const { runtime, calls } = setup(t, {
    availability: "downloadable",
    systemPrompts: [...prompts, thirdPrompt],
    create: async (call) => {
      if (call.key === prompts[0]) throw new DOMException("chat needs activation", "NotAllowedError");
      return call.value;
    },
  });
  await runtime.start();
  await tick();
  assert.equal(runtime.getFeatureStatus(prompts[0]).state, "downloadable");
  assert.equal(await runtime.prepareFeature(prompts[1]), true);
  await tick();
  await tick();
  assert.equal(runtime.getFeatureStatus(thirdPrompt).state, "downloadable");
  assert.equal(runtime.getFeatureStatus(thirdPrompt).active, false);
  assert.equal(calls.filter((call) => call.key === thirdPrompt).length, 0);
  assert.equal(runtime.getFeatureStatus(prompts[0]).state, "downloadable");
});

test("retryStalled retries resources stuck without activation, but only once each", async (t) => {
  let allowed = false;
  const { runtime, calls } = setup(t, {
    availability: "downloadable",
    create: async (call) => {
      if (!allowed) throw new DOMException("no activation yet", "NotAllowedError");
      return call.value;
    },
  });
  await runtime.start();
  await tick();
  assert.equal(runtime.getSnapshot().state, "downloadable");
  allowed = true;
  runtime.retryStalled();
  await tick();
  await tick();
  assert.equal(runtime.getSnapshot().state, "available");
  assert.ok(runtime.getSession(prompts[0]));
  assert.ok(runtime.getTranslators());
  const settledCalls = calls.length;
  runtime.retryStalled();
  await tick();
  // 이미 준비된 자원은 활성화가 있어도 다시 만들지 않는다.
  assert.equal(calls.length, settledCalls);
});

test("shouldRefreshContext requires a refresh on the first turn, then respects the turn budget", async (t) => {
  const { runtime } = setup(t);
  await runtime.start();
  await tick();
  assert.equal(runtime.shouldRefreshContext("unknown prompt", "sig-a", 3), true);
  assert.equal(runtime.shouldRefreshContext(prompts[0], "sig-a", 3), true);
  runtime.recordContextTurn(prompts[0], "sig-a", true);
  assert.equal(runtime.shouldRefreshContext(prompts[0], "sig-a", 3), false);
  runtime.recordContextTurn(prompts[0], "sig-a", false);
  runtime.recordContextTurn(prompts[0], "sig-a", false);
  assert.equal(runtime.shouldRefreshContext(prompts[0], "sig-a", 3), false);
  runtime.recordContextTurn(prompts[0], "sig-a", false);
  // 안 바뀌었어도 지정한 턴 수만큼 지나면 다시 보내야 한다.
  assert.equal(runtime.shouldRefreshContext(prompts[0], "sig-a", 3), true);
  runtime.recordContextTurn(prompts[0], "sig-a", true);
  // 신호가 달라졌으면 턴 수와 무관하게 바로 다시 보내야 한다.
  assert.equal(runtime.shouldRefreshContext(prompts[0], "sig-b", 3), true);
});

test("dispose resets context tracking so a new session starts fresh", async (t) => {
  const { runtime } = setup(t);
  await runtime.start();
  await tick();
  runtime.recordContextTurn(prompts[0], "sig-a", true);
  assert.equal(runtime.shouldRefreshContext(prompts[0], "sig-a", 3), false);
  runtime.dispose();
  await runtime.start();
  await tick();
  assert.equal(runtime.shouldRefreshContext(prompts[0], "sig-a", 3), true);
});

function requestConfig(overrides = {}) {
  return {
    logTag: "test", systemPromptEn: prompts[0], responseSchemaEn: {},
    translateRequest: async (input) => input,
    buildUserTurnEn: (input) => input,
    parseResponse: (raw) => ({ reply: raw }),
    translateResponse: async (reply) => reply,
    timeoutMs: 100,
    ...overrides,
  };
}

test("provider prompt catalog runs budget explanations on device without warming unrelated features", async (t) => {
  const inputs = [];
  const { runtime, calls } = setup(t, {
    systemPrompts: ON_DEVICE_AI_PROMPTS,
    create: async (call) => {
      call.value.prompt = async (input) => {
        inputs.push(input);
        return JSON.stringify({ reasoning: "Keep the budget near comparable campaigns." });
      };
      call.value.translate = async () => "비슷한 캠페인을 참고한 예산이에요.";
      return call.value;
    },
  });
  await runtime.start();
  const budgetPrompt = BUDGET_RECOMMENDATION_SYSTEM_PROMPT_EN;
  assert.equal(runtime.getSession(budgetPrompt), null);
  assert.equal(runtime.getFeatureStatus(budgetPrompt).state, "idle");
  assert.equal(runtime.getFeatureStatus(budgetPrompt).label, "예산 추천 AI");
  const facts = {
    campaignId: "budget-test", objective: "purchase", industry: "food", currentBudget: 40000,
    ownRoas: 200, range: { min: 1000, max: 65000 }, comparableCount: 1,
    comparableAvgRoas: 250, comparableAvgBudget: 48000, recommendedBudget: 48000, direction: "up",
  };
  const result = await runOnDeviceRequest(runtime, requestConfig({
    systemPromptEn: budgetPrompt,
    responseSchemaEn: BUDGET_RECOMMENDATION_RESPONSE_SCHEMA_EN,
    buildUserTurnEn: buildBudgetRecommendationUserTurnEn,
    parseResponse: (raw) => {
      const parsed = JSON.parse(raw);
      return isBudgetRecommendationReply(parsed) ? parsed : null;
    },
    translateResponse: async (reply, translators) => ({ reasoning: await translators.toKo.translate(reply.reasoning) }),
  }), facts, new AbortController());
  assert.deepEqual(result, { reasoning: "비슷한 캠페인을 참고한 예산이에요." });
  assert.equal(inputs.length, 1);
  assert.match(inputs[0], /48000 KRW\/day/);
  assert.equal(runtime.getSnapshot().executions[0].outcome, "success");
  assert.equal(runtime.getSnapshot().executions[0].label, "예산 추천 AI");
  assert.equal(calls.filter((call) => call.key === ON_DEVICE_AI_PROMPTS[1]).length, 0);
});

test("request diagnostics distinguish readiness from actual Nano completion without storing content", async (t) => {
  const { runtime } = setup(t);
  await runtime.start();
  assert.deepEqual(runtime.getSnapshot().executions, []);
  const copy = session();
  copy.prompt = async () => "private answer";
  runtime.getSession(prompts[0]).clone = async () => copy;
  const stages = [];
  runtime.subscribe(() => stages.push(runtime.getSnapshot().executions[0]?.stage));
  const result = await runOnDeviceRequest(runtime, requestConfig(), "private campaign data", new AbortController());
  assert.deepEqual(result, { reply: "private answer" });
  const status = runtime.getSnapshot().executions[0];
  assert.equal(status.outcome, "success");
  assert.equal(status.stage, "translate-output");
  assert.ok(status.durationMs >= 0);
  assert.ok(stages.includes("translate-input"));
  assert.ok(stages.includes("inference"));
  assert.ok(stages.includes("parse"));
  assert.equal(JSON.stringify(status).includes("private"), false);
  assert.equal(JSON.stringify(console.info.mock.calls.map((call) => call.arguments)).includes("private"), false);
  assert.equal(copy.destroyed, 1);
});

for (const [scenario, reason, stage] of [
  ["translate", "failed", "translate-input"],
  ["parse", "invalid-response", "parse"],
  ["timeout", "timeout", "inference"],
]) {
  test(`request reports ${scenario} failure without claiming Nano success`, async (t) => {
    const { runtime } = setup(t);
    await runtime.start();
    const copy = session();
    const gate = deferred();
    copy.prompt = scenario === "timeout" ? () => gate.promise : async () => "answer";
    runtime.getSession(prompts[0]).clone = async () => copy;
    const config = requestConfig({
      timeoutMs: 5,
      ...(scenario === "translate" ? { translateRequest: async () => { throw new Error("private error"); } } : {}),
      ...(scenario === "parse" ? { parseResponse: () => null } : {}),
    });
    const controller = new AbortController();
    assert.equal(await runOnDeviceRequest(runtime, config, "input", controller), null);
    const status = runtime.getSnapshot().executions[0];
    assert.equal(status.outcome, "fallback");
    assert.equal(status.reason, reason);
    assert.equal(status.stage, stage);
    assert.equal(copy.destroyed, 1);
    assert.equal(controller.signal.aborted, true);
    gate.resolve("late answer");
    await tick();
    assert.equal(runtime.getSnapshot().executions[0], status);
  });
}

test("unsupported browser uses an explicit non-Nano outcome without creating sessions", async (t) => {
  const { runtime, calls } = setup(t, { availability: "unavailable" });
  await runtime.start();
  assert.equal(await runOnDeviceRequest(runtime, requestConfig(), "input", new AbortController()), null);
  assert.equal(runtime.getSnapshot().executions[0].reason, "unsupported");
  assert.equal(calls.length, 0);
});

test("older request completion and disposed diagnostics cannot overwrite the latest request", async (t) => {
  const { runtime } = setup(t);
  await runtime.start();
  const old = runtime.beginExecution(prompts[0]);
  const latest = runtime.beginExecution(prompts[0]);
  runtime.updateExecution(old, { stage: "inference", outcome: "success", durationMs: 10 });
  assert.equal(runtime.getSnapshot().executions[0].requestId, latest);
  assert.equal(runtime.getSnapshot().executions[0].outcome, "running");
  runtime.dispose();
  runtime.updateExecution(latest, { stage: "inference", outcome: "success", durationMs: 20 });
  assert.deepEqual(runtime.getSnapshot().executions, []);
});
