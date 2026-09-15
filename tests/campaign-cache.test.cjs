const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const { QueryObserver } = require('@tanstack/react-query');
const { queryClient } = require('../lib/queryClient.ts');
const store = require('../lib/mock/store.ts');
const repo = require('../lib/mock/campaignsRepository.ts');

const detailKey = (id) => ['campaigns', 'detail', id];
const originalFetch = global.fetch;
const observers = new Set();
const campaign = { ...repo.getCampaignsSeed()[0], id: 'cache-test', dailyBudget: 10000 };
const serverCampaign = { ...campaign, name: 'Server campaign', dailyBudget: 20000 };

function json(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function observe(options) {
  const observer = new QueryObserver(queryClient, { ...options, retry: false });
  observer.subscribe(() => {});
  observers.add(observer);
  return observer;
}

function waitForResult(observer, predicate) {
  if (predicate(observer.getCurrentResult())) return Promise.resolve(observer.getCurrentResult());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('Query did not settle')); }, 1000);
    const unsubscribe = observer.subscribe((result) => {
      if (!predicate(result)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    });
  });
}

beforeEach(() => {
  queryClient.clear();
  global.fetch = async (url) => { throw new Error(`Unexpected network request: ${url}`); };
});

afterEach(() => {
  for (const observer of observers) observer.destroy();
  observers.clear();
  queryClient.clear();
  global.fetch = originalFetch;
});

test('campaign freshness is 30 seconds without changing unrelated query defaults or gcTime', () => {
  for (const queryKey of [store.campaignsQueryKey, store.campaignSummaryQueryKey, detailKey(campaign.id)]) {
    const options = queryClient.defaultQueryOptions({ queryKey });
    assert.equal(options.staleTime, 30000);
    assert.equal(options.gcTime, undefined);
  }
  for (const queryKey of [['audiences'], ['creatives'], ['tracking', 'rules']]) {
    assert.equal(queryClient.defaultQueryOptions({ queryKey }).staleTime, undefined);
  }
});

for (const [name, optionsName, keyName, serverData] of [
  ['list', 'campaignsQueryOptions', 'campaignsQueryKey', [serverCampaign]],
  ['summary', 'campaignSummaryQueryOptions', 'campaignSummaryQueryKey', { ...repo.getDashboardSummarySeed(), topCampaigns: [serverCampaign] }],
]) {
  test(`${name} first load waits for real data without showing demo values`, async () => {
    const request = deferred();
    let calls = 0;
    global.fetch = () => { calls++; return request.promise; };
    const observer = observe(store[optionsName]);
    assert.equal(calls, 1);
    assert.equal(observer.getCurrentResult().isPlaceholderData, false);
    assert.equal(observer.getCurrentResult().isPending, true);
    assert.equal(observer.getCurrentResult().data, undefined);
    assert.equal(queryClient.getQueryData(store[keyName]), undefined);
    assert.equal(queryClient.getQueryState(store[keyName]).dataUpdatedAt, 0);
    request.resolve(json(serverData));
    await waitForResult(observer, (result) => !result.isFetching);
    assert.equal(observer.getCurrentResult().isPlaceholderData, false);
    assert.deepEqual(queryClient.getQueryData(store[keyName]), serverData);
  });

  test(`${name} remount reuses fresh data, then refetches after the freshness window`, async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return json(serverData); };
    const first = observe(store[optionsName]);
    await waitForResult(first, (result) => !result.isFetching);
    first.destroy();
    const second = observe(store[optionsName]);
    assert.equal(calls, 1);
    assert.equal(second.getCurrentResult().isFetching, false);
    second.destroy();
    queryClient.setQueryData(store[keyName], serverData, { updatedAt: Date.now() - 31000 });
    const third = observe(store[optionsName]);
    await waitForResult(third, (result) => !result.isFetching);
    assert.equal(calls, 2);
  });
}

test('explicit invalidation refreshes an active summary even inside the freshness window', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return json(repo.getDashboardSummarySeed()); };
  const observer = observe(store.campaignSummaryQueryOptions);
  await waitForResult(observer, (result) => !result.isFetching);
  await queryClient.invalidateQueries({ queryKey: store.campaignSummaryQueryKey });
  assert.equal(calls, 2);
});

test('detail uses a cached list row only as a placeholder and still fetches its own server data', async () => {
  queryClient.setQueryData(store.campaignsQueryKey, [campaign]);
  const request = deferred();
  let calls = 0;
  global.fetch = () => { calls++; return request.promise; };
  const observer = observe(store.campaignDetailQueryOptions(campaign.id));
  assert.equal(calls, 1);
  assert.deepEqual(observer.getCurrentResult().data, campaign);
  assert.equal(observer.getCurrentResult().isPlaceholderData, true);
  assert.equal(queryClient.getQueryData(detailKey(campaign.id)), undefined);
  request.resolve(json(serverCampaign));
  await waitForResult(observer, (result) => !result.isFetching);
  assert.deepEqual(queryClient.getQueryData(detailKey(campaign.id)), serverCampaign);
});

for (const [name, args, changed] of [
  ['updateBudget', [campaign.id, 20000], { dailyBudget: 20000 }],
  ['setStatus', [campaign.id, 'paused'], { status: 'paused' }],
]) {
  test(`${name} patches list and detail immediately and invalidates the fresh summary`, async () => {
    queryClient.setQueryData(store.campaignsQueryKey, [campaign]);
    queryClient.setQueryData(detailKey(campaign.id), campaign);
    queryClient.setQueryData(store.campaignSummaryQueryKey, repo.getDashboardSummarySeed());
    const updated = { ...campaign, ...changed };
    const requests = [];
    global.fetch = async (url, init) => { requests.push({ url, method: init?.method }); return json(updated); };
    await store[name](...args);
    assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [updated]);
    assert.deepEqual(queryClient.getQueryData(detailKey(campaign.id)), updated);
    assert.equal(queryClient.getQueryState(store.campaignSummaryQueryKey).isInvalidated, true);
    assert.deepEqual(requests, [{ url: `/api/campaigns/${campaign.id}`, method: 'PATCH' }]);
  });
}

test('absolute budget recommendation saves the displayed amount when list and detail budgets differ', async () => {
  queryClient.setQueryData(store.campaignsQueryKey, [{ ...campaign, dailyBudget: 30000 }]);
  queryClient.setQueryData(detailKey(campaign.id), { ...campaign, dailyBudget: 40000 });
  queryClient.setQueryData(store.campaignSummaryQueryKey, repo.getDashboardSummarySeed());
  const updated = { ...campaign, dailyBudget: 48000 };
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url, method: init?.method, body: JSON.parse(init.body) });
    return json(updated);
  };

  await store.applyBudgetRecommendation(campaign.id, 48000, 'raise_budget');

  assert.deepEqual(requests, [{
    url: `/api/campaigns/${campaign.id}`,
    method: 'PATCH',
    body: { dailyBudget: 48000, budgetChangeSource: 'recommendation', budgetChangeReasonKind: 'raise_budget' },
  }]);
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [updated]);
  assert.deepEqual(queryClient.getQueryData(detailKey(campaign.id)), updated);
  assert.equal(queryClient.getQueryState(store.campaignSummaryQueryKey).isInvalidated, true);
});

test('absolute budget recommendation rejects invalid amounts before sending a request', async () => {
  let requests = 0;
  global.fetch = async () => { requests++; return json(campaign); };
  for (const amount of [999, 10000001, 1000.5, NaN, Infinity]) {
    await assert.rejects(store.applyBudgetRecommendation(campaign.id, amount, 'lower_budget'), /일 예산은/);
  }
  assert.equal(requests, 0);
});

test('adding without an existing full list never creates a partial list cache', async () => {
  global.fetch = async () => json(serverCampaign);
  await store.addCampaign(serverCampaign);
  assert.equal(queryClient.getQueryData(store.campaignsQueryKey), undefined);
});

test('patching one campaign does not extend freshness of the rest of the cached list', async () => {
  const updatedAt = Date.now() - 31000;
  const untouched = { ...campaign, id: 'untouched' };
  queryClient.setQueryData(store.campaignsQueryKey, [campaign, untouched], { updatedAt });
  global.fetch = async () => json(serverCampaign);
  await store.updateBudget(campaign.id, serverCampaign.dailyBudget);
  assert.equal(queryClient.getQueryState(store.campaignsQueryKey).dataUpdatedAt, updatedAt);
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [serverCampaign, untouched]);
});

test('failed mutation leaves the current cached data unchanged', async () => {
  queryClient.setQueryData(store.campaignsQueryKey, [campaign]);
  queryClient.setQueryData(detailKey(campaign.id), campaign);
  global.fetch = async () => new Response(JSON.stringify({ error: 'Rejected update' }), { status: 500 });
  await assert.rejects(store.updateBudget(campaign.id, 20000), /Rejected update/);
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [campaign]);
  assert.deepEqual(queryClient.getQueryData(detailKey(campaign.id)), campaign);
});

test('delete removes the cached row and detail, and invalidates the summary', async () => {
  queryClient.setQueryData(store.campaignsQueryKey, [campaign]);
  queryClient.setQueryData(detailKey(campaign.id), campaign);
  queryClient.setQueryData(store.campaignSummaryQueryKey, repo.getDashboardSummarySeed());
  global.fetch = async () => json({ ok: true });
  await store.deleteCampaign(campaign.id);
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), []);
  assert.equal(queryClient.getQueryData(detailKey(campaign.id)), undefined);
  assert.equal(queryClient.getQueryState(store.campaignSummaryQueryKey).isInvalidated, true);
});

test('adding to an existing full list preserves the other campaigns', async () => {
  queryClient.setQueryData(store.campaignsQueryKey, [campaign]);
  const created = { ...serverCampaign, id: 'new-campaign' };
  global.fetch = async () => json(created);
  await store.addCampaign(created);
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [created, campaign]);
});

test('reset replaces the list and removes obsolete detail caches', async () => {
  queryClient.setQueryData(store.campaignsQueryKey, [campaign]);
  queryClient.setQueryData(detailKey(campaign.id), campaign);
  queryClient.setQueryData(detailKey('deleted-campaign'), { ...campaign, id: 'deleted-campaign' });
  queryClient.setQueryData(store.campaignSummaryQueryKey, repo.getDashboardSummarySeed());
  global.fetch = async () => json([serverCampaign]);
  await store.resetToSeed();
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [serverCampaign]);
  assert.equal(queryClient.getQueryData(detailKey(campaign.id)), undefined);
  assert.equal(queryClient.getQueryData(detailKey('deleted-campaign')), undefined);
  assert.equal(queryClient.getQueryState(store.campaignSummaryQueryKey).isInvalidated, true);
});

test('late list and detail GET responses cannot overwrite a successful budget update', async () => {
  queryClient.setQueryData(store.campaignsQueryKey, [campaign]);
  queryClient.setQueryData(detailKey(campaign.id), campaign);
  const listRequest = deferred();
  const detailRequest = deferred();
  global.fetch = (url, init) => {
    if (init?.method === 'PATCH') return Promise.resolve(json(serverCampaign));
    return url === '/api/campaigns' ? listRequest.promise : detailRequest.promise;
  };
  const listRead = queryClient.fetchQuery({ ...store.campaignsQueryOptions, staleTime: 0 }).catch(() => null);
  const detailRead = queryClient.fetchQuery({ ...store.campaignDetailQueryOptions(campaign.id), staleTime: 0 }).catch(() => null);
  await store.updateBudget(campaign.id, serverCampaign.dailyBudget);
  listRequest.resolve(json([campaign]));
  detailRequest.resolve(json(campaign));
  await Promise.all([listRead, detailRead]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [serverCampaign]);
  assert.deepEqual(queryClient.getQueryData(detailKey(campaign.id)), serverCampaign);
});

test('mutation restarts an active stale list refresh so unrelated rows also become current', async () => {
  const unrelated = { ...campaign, id: 'unrelated', dailyBudget: 30000 };
  const latestUnrelated = { ...unrelated, dailyBudget: 40000 };
  queryClient.setQueryData(store.campaignsQueryKey, [campaign, unrelated], { updatedAt: Date.now() - 31000 });
  const oldRequest = deferred();
  const newRequest = deferred();
  let listCalls = 0;
  global.fetch = (url, init) => {
    if (init?.method === 'PATCH') return Promise.resolve(json(serverCampaign));
    assert.equal(url, '/api/campaigns');
    listCalls++;
    return listCalls === 1 ? oldRequest.promise : newRequest.promise;
  };
  const observer = observe(store.campaignsQueryOptions);
  assert.equal(listCalls, 1);
  await store.updateBudget(campaign.id, serverCampaign.dailyBudget);
  assert.equal(listCalls, 2, 'canceled active refresh must start again');
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [serverCampaign, unrelated]);
  newRequest.resolve(json([serverCampaign, latestUnrelated]));
  await waitForResult(observer, (result) => !result.isFetching);
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [serverCampaign, latestUnrelated]);
  oldRequest.resolve(json([campaign, unrelated]));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(queryClient.getQueryData(store.campaignsQueryKey), [serverCampaign, latestUnrelated]);
});

test('mutation immediately refetches an active fresh summary', async () => {
  const previousSummary = repo.getDashboardSummarySeed();
  const latestSummary = { ...previousSummary, topCampaigns: [serverCampaign] };
  queryClient.setQueryData(store.campaignSummaryQueryKey, previousSummary);
  const summaryRequest = deferred();
  let summaryCalls = 0;
  global.fetch = (url, init) => {
    if (init?.method === 'PATCH') return Promise.resolve(json(serverCampaign));
    assert.equal(url, '/api/campaigns/summary');
    summaryCalls++;
    return summaryRequest.promise;
  };
  const observer = observe(store.campaignSummaryQueryOptions);
  assert.equal(summaryCalls, 0, 'fresh summary should not fetch on mount');
  await store.updateBudget(campaign.id, serverCampaign.dailyBudget);
  assert.equal(summaryCalls, 1);
  summaryRequest.resolve(json(latestSummary));
  await waitForResult(observer, (result) => !result.isFetching);
  assert.deepEqual(queryClient.getQueryData(store.campaignSummaryQueryKey), latestSummary);
});
