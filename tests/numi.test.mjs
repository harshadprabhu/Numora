import { test } from 'node:test';
import assert from 'node:assert/strict';
import { respond } from '../assets/numi-brain.js';

const ask = (q, ctx, c = 'us') => respond(q, ctx, c);

test('greeting', () => { assert.match(ask('hi').text, /Numi/); });

test('glossary: what is APR', () => {
  const r = ask('what is APR?');
  assert.equal(r.title, 'APR');
});

test('EMI in India with lakh', () => {
  const r = ask('EMI on 10 lakh at 10% for 5 years', {}, 'in');
  assert.equal(r.ctx.intent, 'emi');
  assert.equal(r.ctx.values.principal, 1000000);
  assert.match(r.text, /21,247/);
});

test('follow-up changes the rate relatively', () => {
  const first = ask('loan of 20000 at 9% for 4 years');
  const next = ask('what if the rate is 1% lower?', first.ctx);
  assert.equal(next.ctx.intent, 'emi');
  assert.equal(next.ctx.values.ratePct, 8);
});

test('follow-up changes years', () => {
  const first = ask('loan of 20000 at 9% for 4 years');
  const next = ask('over 3 years instead?', first.ctx);
  assert.equal(next.ctx.values.years, 3);
});

test('SIP with step-up', () => {
  const r = ask('SIP of 10k a month for 15 years at 12% with 10% step up', {}, 'in');
  assert.equal(r.ctx.intent, 'sip');
  assert.equal(r.ctx.values.monthly, 10000);
  assert.equal(r.ctx.values.ratePct, 12);
  assert.equal(r.ctx.values.stepUpPct, 10);
  assert.equal(r.ctx.values.years, 15);
});

test('mortgage with extra payment', () => {
  const r = ask('300k mortgage at 6.5% with 25 years left, can pay 200 extra');
  assert.equal(r.ctx.intent, 'mortgage');
  assert.equal(r.ctx.values.extra, 200);
  assert.match(r.text, /early/);
});

test('mortgage follow-up adds extra', () => {
  const first = ask('300k mortgage at 6.5% with 25 years left');
  const next = ask('what if I pay 200 more a month?', first.ctx);
  assert.equal(next.ctx.values.extra, 200);
});

test('retirement with age and spending', () => {
  const r = ask("I'm 32, spend 3000 a month, have 80k saved and invest 1500 a month. When can I retire?");
  assert.equal(r.ctx.intent, 'fire');
  assert.equal(r.ctx.values.age, 32);
  assert.equal(r.ctx.values.annualSpend, 36000);
  assert.equal(r.ctx.values.savings, 80000);
  assert.equal(r.ctx.values.monthly, 1500);
});

test('credit card payoff', () => {
  const r = ask('credit card balance 5000 at 22%, paying 200 a month');
  assert.equal(r.ctx.intent, 'card');
  assert.equal(r.ctx.values.balance, 5000);
  assert.equal(r.ctx.values.payment, 200);
});

test('FD in India', () => {
  const r = ask('FD of 1 lakh at 7% for 5 years', {}, 'in');
  assert.equal(r.ctx.intent, 'fd');
  assert.match(r.text, /1,41,4/);
});

test('savings goal', () => {
  const r = ask('how much should I save to reach 20000 in 3 years? I have 2000 already');
  assert.equal(r.ctx.intent, 'goal');
  assert.equal(r.ctx.values.target, 20000);
  assert.equal(r.ctx.values.current, 2000);
});

test('inflation', () => {
  const r = ask('what will 1000 cost in 10 years at 6% inflation');
  assert.equal(r.ctx.intent, 'inflation');
  assert.equal(r.ctx.values.amount, 1000);
});

test('rent vs buy', () => {
  const r = ask('should I rent or buy a 500k house, rent is 2000');
  assert.equal(r.ctx.intent, 'rentbuy');
  assert.equal(r.ctx.values.price, 500000);
  assert.equal(r.ctx.values.rent, 2000);
});

test('several debts go to the planner', () => {
  const r = ask('I owe 18k on 3 cards at 24%, can pay 900 a month, snowball or avalanche?');
  assert.ok(r.link.href.startsWith('debt.html'));
});

test('assumptions are stated when numbers are missing', () => {
  const r = ask('When can I retire?');
  assert.match(r.text, /I assumed/);
});

test('unknown input offers suggestions', () => {
  const r = ask('banana');
  assert.ok(r.chips.length > 0);
});
