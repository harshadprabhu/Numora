// Numora calculation engine — pure functions, no DOM, no network.
// All rates are annual percentages (e.g. 6.5 means 6.5%).

/** Monthly periodic rate. Canadian fixed mortgages compound semi-annually. */
export function monthlyRate(annualPct, compounding = 'monthly') {
  const a = annualPct / 100;
  if (a === 0) return 0;
  if (compounding === 'semiannual') return Math.pow(1 + a / 2, 1 / 6) - 1;
  return a / 12;
}

/** Level payment for a fully amortizing loan. */
export function levelPayment(principal, rate, months) {
  if (months <= 0) return principal;
  if (rate === 0) return principal / months;
  return (principal * rate) / (1 - Math.pow(1 + rate, -months));
}

/**
 * Month-by-month amortization.
 * @returns {{months:number,totalInterest:number,balances:number[],neverPaysOff:boolean}}
 */
export function amortize({ principal, rate, payment, extra = 0, lumpSum = 0, lumpMonth = 0, maxMonths = 1200 }) {
  let bal = principal;
  let totalInterest = 0;
  const balances = [bal];
  let m = 0;
  while (bal > 0.005 && m < maxMonths) {
    m += 1;
    const interest = bal * rate;
    let pay = payment + extra + (m === lumpMonth ? lumpSum : 0);
    if (pay <= interest && m !== lumpMonth) {
      return { months: Infinity, totalInterest: Infinity, balances, neverPaysOff: true };
    }
    if (pay > bal + interest) pay = bal + interest;
    totalInterest += interest;
    bal = bal + interest - pay;
    balances.push(Math.max(bal, 0));
  }
  return { months: m, totalInterest, balances, neverPaysOff: bal > 0.005 };
}

/**
 * Mortgage payoff with extra payments.
 * inputs: { balance, ratePct, yearsLeft, extra, lumpSum, lumpMonth, compounding }
 */
export function mortgagePayoff(inputs) {
  const { balance, ratePct, yearsLeft, extra = 0, lumpSum = 0, lumpMonth = 12, compounding = 'monthly' } = inputs;
  const rate = monthlyRate(ratePct, compounding);
  const n = Math.round(yearsLeft * 12);
  const payment = levelPayment(balance, rate, n);
  const base = amortize({ principal: balance, rate, payment });
  const plan = amortize({ principal: balance, rate, payment, extra, lumpSum, lumpMonth });
  return {
    payment,
    rate,
    base,
    plan,
    monthsSaved: base.months - plan.months,
    interestSaved: base.totalInterest - plan.totalInterest,
  };
}

/** Validate mortgage inputs; returns a map of field -> message. */
export function validateMortgage(i) {
  const e = {};
  if (!(i.balance > 0)) e.balance = 'Enter a balance above zero.';
  if (!(i.ratePct >= 0 && i.ratePct < 40)) e.ratePct = 'Enter a rate between 0% and 40%.';
  if (!(i.yearsLeft > 0 && i.yearsLeft <= 50)) e.yearsLeft = 'Enter between 1 month and 50 years.';
  if (i.extra < 0) e.extra = 'Extra payment cannot be negative.';
  if (i.lumpSum < 0) e.lumpSum = 'Lump sum cannot be negative.';
  return e;
}

/**
 * Debt payoff simulation.
 * debts: [{ name, balance, apr, min }], budget: total monthly amount, method: 'avalanche' | 'snowball'
 */
export function debtPayoff(debts, budget, method = 'avalanche', maxMonths = 600) {
  const list = debts.map((d, idx) => ({ ...d, idx, bal: d.balance, paidOffMonth: null }));
  const minTotal = list.reduce((s, d) => s + d.min, 0);
  if (budget < minTotal) {
    return { error: 'budget-below-minimums', minTotal };
  }
  let month = 0;
  let totalInterest = 0;
  const totals = [list.reduce((s, d) => s + d.bal, 0)];
  const order = [];
  while (list.some(d => d.bal > 0.005) && month < maxMonths) {
    month += 1;
    // Interest accrues first.
    for (const d of list) {
      if (d.bal > 0.005) {
        const i = d.bal * (d.apr / 100 / 12);
        d.bal += i;
        totalInterest += i;
      }
    }
    let remaining = budget;
    // Pay minimums.
    for (const d of list) {
      if (d.bal > 0.005) {
        const p = Math.min(d.min, d.bal);
        d.bal -= p;
        remaining -= p;
      }
    }
    // Put everything else on the target debt, rolling over when one is cleared.
    const active = () => list.filter(d => d.bal > 0.005);
    while (remaining > 0.005 && active().length) {
      const target = active().sort((a, b) =>
        method === 'snowball' ? a.bal - b.bal || b.apr - a.apr : b.apr - a.apr || a.bal - b.bal
      )[0];
      const p = Math.min(remaining, target.bal);
      target.bal -= p;
      remaining -= p;
    }
    for (const d of list) {
      if (d.bal <= 0.005 && d.paidOffMonth === null) {
        d.bal = 0;
        d.paidOffMonth = month;
        order.push({ name: d.name, month });
      }
    }
    totals.push(list.reduce((s, d) => s + d.bal, 0));
    if (month > 1 && totals[month] >= totals[month - 1] - 0.005 && totals[month] > 0.005) {
      return { error: 'not-reducing' };
    }
  }
  return { months: month, totalInterest, order, totals, finished: !list.some(d => d.bal > 0.005) };
}

/** Binary search: smallest monthly extra that clears the mortgage within targetMonths. */
export function solveExtraForTarget(inputs, targetMonths) {
  const { payment } = mortgagePayoff({ ...inputs, extra: 0, lumpSum: 0 });
  let lo = 0, hi = inputs.balance;
  const months = x => mortgagePayoff({ ...inputs, extra: x, lumpSum: 0 }).plan.months;
  if (months(0) <= targetMonths) return 0;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (months(mid) <= targetMonths) hi = mid; else lo = mid;
  }
  return Math.ceil(hi);
}
