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

// ---------------------------------------------------------------------------
// More calculators. All pure; rates in % per year; money in the user's currency.

/** Loan EMI / repayment. */
export function emi({ principal, ratePct, years }) {
  const months = Math.round(years * 12);
  const r = monthlyRate(ratePct);
  const pay = levelPayment(principal, r, months);
  const a = amortize({ principal, rate: r, payment: pay });
  return { emi: pay, months, totalInterest: a.totalInterest, totalPaid: principal + a.totalInterest, balances: a.balances };
}

/** SIP / monthly investing, contribution at the start of each month, optional yearly step-up. */
export function sip({ monthly, ratePct, years, stepUpPct = 0 }) {
  const r = ratePct / 100 / 12;
  const n = Math.round(years * 12);
  let value = 0, invested = 0, contrib = monthly;
  const values = [0], investedSeries = [0];
  for (let m = 1; m <= n; m++) {
    if (m > 1 && (m - 1) % 12 === 0) contrib *= 1 + stepUpPct / 100;
    value = (value + contrib) * (1 + r);
    invested += contrib;
    values.push(value);
    investedSeries.push(invested);
  }
  return { value, invested, gains: value - invested, values, investedSeries };
}

/** Compound interest with optional monthly additions and compounding n times a year. */
export function compound({ principal, monthly = 0, ratePct, years, perYear = 12 }) {
  const i = Math.pow(1 + ratePct / 100 / perYear, perYear / 12) - 1;
  const n = Math.round(years * 12);
  let value = principal, contributed = principal;
  const values = [value], contributedSeries = [contributed];
  for (let m = 1; m <= n; m++) {
    value = value * (1 + i) + monthly;
    contributed += monthly;
    values.push(value);
    contributedSeries.push(contributed);
  }
  return { value, contributed, interest: value - contributed, values, contributedSeries };
}

/** Monthly saving needed to reach a target (deposits at month end). */
export function savingsGoal({ target, current = 0, ratePct, years }) {
  const i = ratePct / 100 / 12;
  const n = Math.round(years * 12);
  if (n <= 0) return { monthly: Math.max(0, target - current), months: 0 };
  const growth = Math.pow(1 + i, n);
  const fromCurrent = current * growth;
  const need = Math.max(0, target - fromCurrent);
  const monthly = i === 0 ? need / n : need * i / (growth - 1);
  const path = compound({ principal: current, monthly, ratePct, years, perYear: 12 });
  return { monthly, months: n, fromCurrent, totalDeposits: monthly * n, values: path.values };
}

/** Fixed deposit / term deposit / CD. perYear = compounding periods per year. */
export function fixedDeposit({ principal, ratePct, years, perYear = 4 }) {
  const maturity = principal * Math.pow(1 + ratePct / 100 / perYear, perYear * years);
  const values = [];
  for (let m = 0; m <= Math.round(years * 12); m++) values.push(principal * Math.pow(1 + ratePct / 100 / perYear, (perYear * m) / 12));
  return { maturity, interest: maturity - principal, values, effectivePct: (Math.pow(1 + ratePct / 100 / perYear, perYear) - 1) * 100 };
}

/** Financial independence: years until savings reach annual spend / withdrawal rate (in today's money). */
export function fire({ age, annualSpend, savings, monthly, ratePct, inflationPct, withdrawalPct = 4, maxYears = 70 }) {
  const target = annualSpend / (withdrawalPct / 100);
  const run = rp => {
    const real = (1 + rp / 100) / (1 + inflationPct / 100) - 1;
    const i = Math.pow(1 + real, 1 / 12) - 1;
    let v = savings; const series = [v];
    for (let y = 1; y <= maxYears; y++) {
      for (let m = 0; m < 12; m++) v = v * (1 + i) + monthly;
      series.push(v);
      if (v >= target) return { years: y, series };
    }
    return { years: Infinity, series };
  };
  const mid = run(ratePct), low = run(ratePct - 2), high = run(ratePct + 2);
  return { target, years: mid.years, age: age + mid.years, series: mid.series, pessimisticAge: age + low.years, optimisticAge: age + high.years, already: savings >= target };
}

/** Inflation: what something costs later, and what money is worth later. */
export function inflation({ amount, inflationPct, years }) {
  const k = Math.pow(1 + inflationPct / 100, years);
  const values = [];
  for (let y = 0; y <= Math.round(years); y++) values.push(amount * Math.pow(1 + inflationPct / 100, y));
  return { futureCost: amount * k, purchasingPower: amount / k, values };
}

/** Credit card payoff at a fixed monthly payment, plus the payment needed to clear it in `targetMonths`. */
export function creditCard({ balance, aprPct, payment, targetMonths = 24 }) {
  const r = aprPct / 100 / 12;
  const a = amortize({ principal: balance, rate: r, payment });
  return { months: a.months, totalInterest: a.totalInterest, neverPaysOff: a.neverPaysOff, balances: a.balances, paymentForTarget: levelPayment(balance, r, targetMonths), minInterest: balance * r };
}

/**
 * Rent vs buy over a horizon. Both sides invest their spare cash at investPct.
 * Returns net worth by year for each and the first year buying comes out ahead.
 */
export function rentVsBuy({ price, depositPct, ratePct, loanYears, rent, rentGrowthPct, priceGrowthPct, investPct, horizon, buyCostsPct = 5, upkeepPct = 1 }) {
  const deposit = price * depositPct / 100;
  const loan = price - deposit;
  const r = monthlyRate(ratePct);
  const pay = levelPayment(loan, r, Math.round(loanYears * 12));
  const inv = Math.pow(1 + investPct / 100, 1 / 12) - 1;
  let bal = loan, home = price, curRent = rent;
  let renterPot = deposit + price * buyCostsPct / 100, buyerPot = 0;
  const buyNW = [deposit - price * buyCostsPct / 100], rentNW = [renterPot];
  let breakeven = null;
  for (let m = 1; m <= horizon * 12; m++) {
    const interest = bal * r;
    const mortgage = bal > 0.005 ? Math.min(pay, bal + interest) : 0;
    bal = Math.max(0, bal + interest - mortgage);
    const upkeep = home * upkeepPct / 100 / 12;
    const buyOut = mortgage + upkeep;
    home *= Math.pow(1 + priceGrowthPct / 100, 1 / 12);
    renterPot *= 1 + inv; buyerPot *= 1 + inv;
    if (buyOut > curRent) renterPot += buyOut - curRent; else buyerPot += curRent - buyOut;
    if (m % 12 === 0) {
      curRent *= 1 + rentGrowthPct / 100;
      const b = home - bal + buyerPot, rr = renterPot;
      buyNW.push(b); rentNW.push(rr);
      if (breakeven === null && b >= rr) breakeven = m / 12;
    }
  }
  return { payment: pay, buyNW, rentNW, breakeven, buyFinal: buyNW[buyNW.length - 1], rentFinal: rentNW[rentNW.length - 1] };
}
