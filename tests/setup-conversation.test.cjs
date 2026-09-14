const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isSetupRequest, isSetupEdit, newSetupDraft, editSetupFromMessage } = require('../lib/campaigns/setupConversation.ts');
const { validateCampaignSetup } = require('../lib/campaigns/setup.ts');
const { recentConversation, waitingCorrection } = require('../lib/ai/conversation.ts');
const { buildUserTurnEn } = require('../lib/ai/systemPrompt.ts');

test('creation phrases open setup but cancellation and existing campaign changes do not', () => {
  for (const text of ['광고 세팅해줘', '새 광고 만들기', '캠페인 하나 만들어줘', '쇼핑몰 홍보하고 싶어', '신규 캠페인']) assert.equal(isSetupRequest(text), true, text);
  for (const text of ['광고 만들지 마', '기존 광고 예산 바꿔줘', '캠페인 생성 취소']) assert.equal(isSetupRequest(text), false, text);
});
test('name stays empty for server-time naming and default range is seven KST days', () => {
  const draft = newSetupDraft(new Date('2026-09-12T16:00:00Z'));
  assert.equal(draft.name, ''); assert.equal(draft.startDate, '2026-09-13'); assert.equal(draft.endDate, '2026-09-19');
  assert.equal(draft.totalBudget, 100000);
});
test('budget-only followup edits same draft without resetting selected code or dates', () => {
  const base = { ...newSetupDraft(), name:'가을', trackingConnectionId:'verified-code' };
  assert.equal(isSetupEdit('20만원으로'), true);
  const next = editSetupFromMessage(base, '예산만 20만원으로').draft;
  assert.deepEqual(next, { ...base, totalBudget:200000 });
  assert.equal(next.requestId, base.requestId);
});
test('below minimum and negative budget is not silently increased', () => {
  for(const message of ['예산 5만원으로', '예산 -100000원', '예산 100050원']) {
    const { draft }=editSetupFromMessage(newSetupDraft(),message);
    assert.equal(validateCampaignSetup({...draft,saveAsDraft:true}).ok,false,message);
  }
});
test('daily budget never becomes a total budget silently', () => {
  const base=newSetupDraft();const result=editSetupFromMessage(base,'하루 예산 20만원');
  assert.equal(result.draft.totalBudget,base.totalBudget);assert.match(result.note,/전체 기간/);
});
test('no-end, exact dates, period and user-provided names change only corresponding fields', () => {
  const base=newSetupDraft(new Date('2026-09-12T16:00:00Z'));
  assert.equal(editSetupFromMessage(base,'종료일 없이').draft.endDate,null);
  assert.equal(editSetupFromMessage(base,'기간 2주간').draft.endDate,'2026-09-26');
  assert.equal(editSetupFromMessage(base,'이름은 "가을 할인"').draft.name,'가을 할인');
  assert.equal(editSetupFromMessage(base,'종료일 2026-09-30').draft.endDate,'2026-09-30');
});
test('duration is calculated from the requested start date and invalid dates do not throw', () => {
  const base = newSetupDraft(new Date('2026-09-12T16:00:00Z'));
  const next = editSetupFromMessage(base, '시작일 2026-10-01, 기간 2주간').draft;
  assert.equal(next.startDate, '2026-10-01');
  assert.equal(next.endDate, '2026-10-14');
  const invalid = editSetupFromMessage(base, '시작일 2026-99-99, 기간 2주간');
  assert.equal(validateCampaignSetup({ ...invalid.draft, saveAsDraft: true }).ok, false);
  assert.equal(editSetupFromMessage(base, '7일 동안 말고 종료일 없이').draft.endDate, null);
});
test('visible rule-based and fallback replies are included, pending responses excluded, history bounded', () => {
  const history=recentConversation([
    {role:'user',text:'전환율 낮은 캠페인은?'},
    {role:'assistant',reply:{reply:'확인된 실적이 없어요.',actions:[]},engineUsed:'preview'},
    {role:'assistant',pending:true},
  ]);
  assert.equal(history.length,2);assert.equal(history[1].text,'확인된 실적이 없어요.');
  assert.match(buildUserTurnEn('why?', '[]', history),/확인된 실적이 없어요/);
  const many=recentConversation(Array.from({length:30},()=>({role:'user',text:'x'.repeat(1000)})));
  assert.equal(many.length,8);assert.ok(many.every(t=>t.text.length<=800));
});
test('screenshot followup corrects fictional waiting instead of asking user to wait', () => {
  const history=[{role:'assistant',text:'데이터를 처리하는 동안 잠시만요.'}];
  assert.match(waitingCorrection('기다리면 답해주는 거야?',history),/잘못 안내/);
  assert.match(waitingCorrection('너가 데이터를 처리하는 동안 잠시만요라며',history),/추가 작업은 없어요/);
  assert.equal(waitingCorrection('안녕하세요',history),null);
});
