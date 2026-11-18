import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyRate, levelPayment, mortgagePayoff, debtPayoff, solveExtraForTarget } from '../assets/engine.js';
import { parseAmount, parseMortgage, parseDebts } from '../assets/parser.js';
import { mortgageInsights, debtInsights } from '../assets/insights.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('standard 30-year payment: 200,000 at 6% = 1,199.10', () => {
  close(levelPayment(200000, monthlyRate(6), 360), 1199.10, 0.01);
});

test('zero-rate loan divides evenly', () => {
  close(levelPayment(12000, 0, 12), 1000);
});

test('Canadian semi-annual compounding: 6% nominal gives 0.4939% monthly', () => {
  close(monthlyRate(6, 'semiannual') * 100, 0.493862, 0.00001);
});

test('payoff with no extra takes the full term', () => {
  const r = mortgagePayoff({ balance: 200000, ratePct: 6, yearsLeft: 30 });
  assert.equal(r.base.months, 360);
  close(r.base.totalInterest, 1199.10 * 360 - 200000, 5);
  assert.equal(r.monthsSaved, 0);
});

test('extra payment shortens the loan and saves interest', () => {
  const r = mortgagePayoff({ balance: 200000, ratePct: 6, yearsLeft: 30, extra: 200 });
  assert.ok(r.plan.months < 360);
  assert.ok(r.interestSaved > 0);
});

test('goal solver finds an extra that hits the target', () => {
  const inputs = { balance: 200000, ratePct: 6, yearsLeft: 30 };
  const x = solveExtraForTarget(inputs, 240);
  assert.ok(mortgagePayoff({ ...inputs, extra: x }).plan.months <= 240);
  assert.ok(mortgagePayoff({ ...inputs, extra: x - 2 }).plan.months > 240);
});

test('avalanche never costs more interest than snowball', () => {
  const debts = [
    { name: 'A', balance: 6500, apr: 24.9, min: 160 },
    { name: 'B', balance: 1800, apr: 29.9, min: 55 },
    { name: 'C', balance: 9800, apr: 7.9, min: 290 },
  ];
  const a = debtPayoff(debts, 900, 'avalanche');
  const s = debtPayoff(debts, 900, 'snowball');
  assert.ok(a.finished && s.finished);
  assert.ok(a.totalInterest <= s.totalInterest + 0.01);
  assert.equal(s.order[0].name, 'B');
});

test('budget below minimums is flagged', () => {
  const r = debtPayoff([{ name: 'A', balance: 1000, apr: 20, min: 100 }], 50);
  assert.equal(r.error, 'budget-below-minimums');
});

test('amount parsing across formats', () => {
  assert.equal(parseAmount('18k'), 18000);
  assert.equal(parseAmount('2,50,000'), 250000);
  assert.equal(parseAmount('1.5 lakh'), 150000);
  assert.equal(parseAmount('£220,000'), 220000);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('2 crore'), 20000000);
});

test('mortgage sentence parsing', () => {
  const { found } = parseMortgage('300k mortgage at 6.5% with 25 years left, can pay 200 extra');
  assert.deepEqual(found, { ratePct: 6.5, yearsLeft: 25, extra: 200, balance: 300000 });
});

test('Indian home loan sentence', () => {
  const { found } = parseMortgage('45 lakh home loan, 8.5 percent, 20 yrs, one-off bonus 2 lakh');
  assert.equal(found.balance, 4500000);
  assert.equal(found.lumpSum, 200000);
  assert.equal(found.ratePct, 8.5);
  assert.equal(found.yearsLeft, 20);
});

test('debt sentence parsing', () => {
  const { found } = parseDebts('I owe $18k on 3 cards at 24%, can pay 900 a month');
  assert.equal(found.budget, 900);
  assert.equal(found.debts.length, 3);
  assert.equal(found.debts[0].apr, 24);
  assert.equal(found.debts.reduce((s, d) => s + d.balance, 0), 18000);
});

const f = { money: v => `$${Math.round(v)}`, duration: m => `${m} mo` };

test('mortgage insights give up to 4 plain sentences', () => {
  const inputs = { balance: 350000, ratePct: 6.5, yearsLeft: 25 };
  const out = mortgageInsights(inputs, mortgagePayoff(inputs), f, 100);
  assert.ok(out.length >= 2 && out.length <= 4);
  assert.ok(out.every(i => typeof i.text === 'string' && i.text.length > 20));
});

test('0% loan still gets an explanation', () => {
  const inputs = { balance: 100000, ratePct: 0, yearsLeft: 10 };
  const out = mortgageInsights(inputs, mortgagePayoff(inputs), f, 100);
  assert.ok(out.some(i => i.text.includes('0% interest')));
});

test('debt insights handle a budget below minimums', () => {
  const debts = [{ name: 'A', balance: 1000, apr: 20, min: 100 }];
  const res = { avalanche: debtPayoff(debts, 50, 'avalanche'), snowball: debtPayoff(debts, 50, 'snowball') };
  const out = debtInsights(debts, 50, res, { ...f }, 100);
  assert.equal(out[0].tone, 'warn');
});

import { emi, sip, compound, savingsGoal, fixedDeposit, fire, inflation, creditCard, rentVsBuy } from '../assets/engine.js';

test('EMI: 10 lakh at 10% for 5 years ≈ 21,247', () => {
  close(emi({ principal: 1000000, ratePct: 10, years: 5 }).emi, 21247.04, 0.05);
});

test('SIP: 10,000/month at 12% for 10 years ≈ 23.23 lakh (start-of-month)', () => {
  const r = sip({ monthly: 10000, ratePct: 12, years: 10 });
  close(r.invested, 1200000);
  close(r.value, 2323390.76, 5);
});

test('SIP step-up increases contributions yearly', () => {
  const r = sip({ monthly: 1000, ratePct: 0, years: 2, stepUpPct: 10 });
  close(r.invested, 12000 + 13200);
});

test('compound: 10,000 at 5% yearly compounding for 10 years = 16,288.95', () => {
  close(compound({ principal: 10000, ratePct: 5, years: 10, perYear: 1 }).value, 16288.95, 0.05);
});

test('savings goal: monthly amount reaches the target', () => {
  const g = savingsGoal({ target: 50000, current: 5000, ratePct: 4, years: 5 });
  const check = compound({ principal: 5000, monthly: g.monthly, ratePct: 4, years: 5, perYear: 12 });
  close(check.value, 50000, 0.5);
});

test('FD: 1 lakh at 7% quarterly for 5 years ≈ 1,41,478', () => {
  close(fixedDeposit({ principal: 100000, ratePct: 7, years: 5, perYear: 4 }).maturity, 141478.4, 1);
});

test('FIRE target is spend / withdrawal rate and is reached', () => {
  const f = fire({ age: 30, annualSpend: 40000, savings: 50000, monthly: 2000, ratePct: 7, inflationPct: 3 });
  assert.equal(f.target, 1000000);
  assert.ok(f.years > 5 && f.years < 40);
  assert.ok(f.optimisticAge <= f.age && f.age <= f.pessimisticAge);
});

test('inflation doubles in ~10 years at 7.2%', () => {
  close(inflation({ amount: 100, inflationPct: 7.2, years: 10 }).futureCost, 200.4, 0.2);
});

test('credit card: payment below interest never pays off', () => {
  assert.ok(creditCard({ balance: 5000, aprPct: 24, payment: 90 }).neverPaysOff);
  assert.ok(creditCard({ balance: 5000, aprPct: 24, payment: 300 }).months < 24);
});

test('rent vs buy returns a series per year', () => {
  const r = rentVsBuy({ price: 400000, depositPct: 20, ratePct: 6, loanYears: 30, rent: 1800, rentGrowthPct: 3, priceGrowthPct: 3, investPct: 6, horizon: 15 });
  assert.equal(r.buyNW.length, 16);
  assert.equal(r.rentNW.length, 16);
});
