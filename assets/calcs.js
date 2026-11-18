// Calculator definitions. Pure: no DOM. Text comes from i18n via t().
import { mortgagePayoff, solveExtraForTarget, emi, sip, compound, savingsGoal, fixedDeposit, fire, inflation, creditCard, rentVsBuy, debtPayoff } from './engine.js';
import { COUNTRIES, localeOf } from './countries.js';
import { makeT, FD_EN } from './i18n.js';

export function nice(v) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
}

/** Formatters for a country + language. */
export function fmt(country, lang) {
  const c = COUNTRIES[country];
  const loc = localeOf(country, lang);
  const big = new Intl.NumberFormat(loc, { style: 'currency', currency: c.currency, maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 });
  const yrs = new Intl.NumberFormat(loc, { style: 'unit', unit: 'year', unitDisplay: 'long', maximumFractionDigits: 1 });
  const mos = new Intl.NumberFormat(loc, { style: 'unit', unit: 'month', unitDisplay: 'short' });
  const t = makeT(lang);
  return {
    locale: loc,
    money: v => (Number.isFinite(v) ? big.format(Math.round(v)) : '—'),
    compact: v => new Intl.NumberFormat(loc, { style: 'currency', currency: c.currency, notation: 'compact', maximumFractionDigits: 1 }).format(v),
    num: v => num.format(v),
    pct: v => `${num.format(Math.round(v * 100) / 100)}%`,
    years: y => yrs.format(y),
    duration: months => {
      if (!Number.isFinite(months)) return t('never');
      const y = Math.floor(months / 12), m = Math.round(months % 12);
      if (y && m) return `${yrs.format(y)} ${mos.format(m)}`;
      return y ? yrs.format(y) : mos.format(m);
    },
    date: monthsFromNow => {
      if (!Number.isFinite(monthsFromNow)) return t('never');
      const d = new Date(); d.setMonth(d.getMonth() + Math.round(monthsFromNow));
      return new Intl.DateTimeFormat(loc, { month: 'short', year: 'numeric' }).format(d);
    },
    symbol: (() => { const p = big.formatToParts(0).find(x => x.type === 'currency'); return p ? p.value : c.currency; })(),
  };
}

export const ICONS = {
  mortgage: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  emi: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  debt: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  rentbuy: 'M3 21V10l9-6 9 6v11M9 21v-6h6v6',
  sip: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  compound: 'M12 20V4M5 11l7-7 7 7',
  goal: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10z',
  fd: 'M4 10h16v10H4zM2 10l10-6 10 6M8 14v3M12 14v3M16 14v3',
  fire: 'M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5',
  inflation: 'M3 3v18h18M7 15l4-4 3 3 6-7',
};

export const ORDER = [
  ['borrow', ['mortgage', 'emi', 'card', 'debt', 'rentbuy']],
  ['grow', ['sip', 'compound', 'goal', 'fd']],
  ['plan', ['fire', 'inflation']],
];

/** Display name of a calculator for a country/language. */
export function calcName(id, country, lang) {
  const c = COUNTRIES[country], t = makeT(lang);
  if (id === 'mortgage') return t(c.homeLoan && lang === 'en' ? 'c.mortgageHL' : 'c.mortgage');
  if (id === 'emi') return t(c.emiName && lang === 'en' ? 'c.emiIN' : 'c.emi');
  if (id === 'sip') return t(c.sipName && lang === 'en' ? 'c.sipIN' : 'c.sip');
  if (id === 'fd' && lang === 'en' && FD_EN[country]) return FD_EN[country];
  return t('c.' + id);
}

/**
 * Calculator configs. Each has fields (kind: money|pct|years|num) and view() -> what to show.
 * The debt planner is special (a list of debts) and is handled separately.
 */
export function configs(country, lang) {
  const c = COUNTRIES[country];
  const R = c.rates;
  const t = makeT(lang);
  const M = base => nice(base * c.scale);
  const step = c.step;

  return {
    mortgage: {
      fields: [
        { id: 'balance', label: t('f.balance'), kind: 'money', def: c.mortgage.balance, max: c.mortgage.balance * 4 },
        { id: 'ratePct', label: t('f.rate'), kind: 'pct', def: c.mortgage.ratePct, max: 20 },
        { id: 'yearsLeft', label: t('f.yearsLeft'), kind: 'years', def: c.mortgage.yearsLeft, max: 40 },
        { id: 'extra', label: t('f.extra'), kind: 'money', def: step * 2, max: step * 40 },
        { id: 'lumpSum', label: t('f.lump'), kind: 'money', def: 0, max: c.mortgage.balance / 2, advanced: true },
      ],
      run: v => mortgagePayoff({ ...v, lumpMonth: 12, compounding: c.compounding }),
      view: (r, v, f) => {
        const never = r.plan.neverPaysOff;
        const target = Math.max(1, Math.round(v.yearsLeft - 5));
        const x = v.yearsLeft > 6 ? solveExtraForTarget({ ...v, lumpSum: 0, compounding: c.compounding }, target * 12) : 0;
        const more = mortgagePayoff({ ...v, extra: (v.extra || 0) + step, lumpMonth: 12, compounding: c.compounding });
        return {
          headline: { label: t('h.mortgage'), value: never ? t('never') : f.date(r.plan.months) },
          sub: never ? '' : f.duration(r.plan.months),
          stats: [
            { label: t('s.saved'), value: f.money(Math.max(0, r.interestSaved)), good: true },
            { label: t('s.time'), value: r.monthsSaved > 0 ? f.duration(r.monthsSaved) : '—', good: true },
            { label: t('s.pay'), value: f.money(r.payment + (v.extra || 0)) },
          ],
          answer: (v.extra > 0 || v.lumpSum > 0) && !never
            ? t('a.mortgage', { x: f.money(v.extra), b: f.money(v.balance), r: f.num(v.ratePct), d: f.date(r.plan.months), t: f.duration(r.monthsSaved), s: f.money(r.interestSaved) })
            : t('a.mortgage0', { b: f.money(v.balance), r: f.num(v.ratePct), y: f.years(v.yearsLeft), p: f.money(r.payment), i: f.money(r.base.totalInterest) }),
          insights: [
            !more.plan.neverPaysOff && !never ? { tone: 'good', text: t('i.mortgage1', { x: f.money(step), s: f.money(r.plan.totalInterest - more.plan.totalInterest), t: f.duration(r.plan.months - more.plan.months) }) } : null,
            x > 0 ? { tone: 'neutral', text: t('i.mortgage2', { y: f.years(target), x: f.money(x) }) } : null,
          ].filter(Boolean),
          chart: { series: [{ data: r.base.balances, tone: 'muted', dash: true }, { data: r.plan.balances, tone: 'accent', fill: true }], legend: [['accent', t('l.balance')]] },
        };
      },
    },

    emi: {
      fields: [
        { id: 'principal', label: t('f.loan'), kind: 'money', def: M(25000), max: M(500000) },
        { id: 'ratePct', label: t('f.rate'), kind: 'pct', def: R.loan, max: 40 },
        { id: 'years', label: t('f.term'), kind: 'years', def: 5, max: 30 },
      ],
      run: v => emi(v),
      view: (r, v, f) => {
        const shorter = v.years > 1 ? emi({ ...v, years: v.years - 1 }) : null;
        const lower = v.ratePct > 1 ? emi({ ...v, ratePct: v.ratePct - 1 }) : null;
        return {
          headline: { label: t('h.emi'), value: f.money(r.emi), num: r.emi },
          sub: f.duration(r.months),
          stats: [{ label: t('s.totalInt'), value: f.money(r.totalInterest) }, { label: t('s.totalPaid'), value: f.money(r.totalPaid) }, { label: t('f.rate'), value: f.pct(v.ratePct) }],
          answer: t('a.emi', { p: f.money(v.principal), r: f.num(v.ratePct), y: f.years(v.years), e: f.money(r.emi), i: f.money(r.totalInterest) }),
          insights: [
            shorter && { tone: 'good', text: t('i.emi1', { e: f.money(shorter.emi), s: f.money(r.totalInterest - shorter.totalInterest) }) },
            lower && { tone: 'good', text: t('i.emi2', { s: f.money(r.totalInterest - lower.totalInterest) }) },
          ].filter(Boolean),
          chart: { series: [{ data: r.balances, tone: 'accent', fill: true }], legend: [['accent', t('l.balance')]] },
        };
      },
    },

    card: {
      fields: [
        { id: 'balance', label: t('f.cardBal'), kind: 'money', def: M(5000), max: M(50000) },
        { id: 'aprPct', label: t('f.apr'), kind: 'pct', def: R.card, max: 150 },
        { id: 'payment', label: t('f.payment'), kind: 'money', def: M(200), max: M(5000) },
      ],
      run: v => creditCard({ ...v, targetMonths: 24 }),
      view: (r, v, f) => {
        const more = creditCard({ ...v, payment: v.payment * 1.5 });
        return {
          headline: { label: t('h.card'), value: r.neverPaysOff ? t('never') : f.date(r.months) },
          sub: r.neverPaysOff ? '' : f.duration(r.months),
          stats: [{ label: t('s.totalInt'), value: r.neverPaysOff ? '—' : f.money(r.totalInterest) }, { label: t('s.clear2y'), value: f.money(r.paymentForTarget) }, { label: t('f.apr'), value: f.pct(v.aprPct) }],
          answer: r.neverPaysOff ? t('a.cardNever', { p: f.money(v.payment), i: f.money(r.minInterest) })
            : t('a.card', { p: f.money(v.payment), b: f.money(v.balance), r: f.num(v.aprPct), t: f.duration(r.months), i: f.money(r.totalInterest) }),
          insights: [
            !r.neverPaysOff && !more.neverPaysOff ? { tone: 'good', text: t('i.card1', { p: f.money(v.payment * 1.5), s: f.money(r.totalInterest - more.totalInterest), t: f.duration(r.months - more.months) }) } : null,
            { tone: 'neutral', text: t('i.card2', { p: f.money(r.paymentForTarget) }) },
          ].filter(Boolean),
          chart: { series: [{ data: r.balances, tone: 'accent', fill: true }], legend: [['accent', t('l.balance')]] },
        };
      },
    },

    rentbuy: {
      fields: [
        { id: 'price', label: t('f.price'), kind: 'money', def: M(400000), max: M(3000000) },
        { id: 'rent', label: t('f.rent'), kind: 'money', def: M(1800), max: M(15000) },
        { id: 'horizon', label: t('f.stay'), kind: 'years', def: 10, max: 30 },
        { id: 'depositPct', label: t('f.deposit'), kind: 'pct', def: 20, max: 80, advanced: true },
        { id: 'ratePct', label: t('f.rate'), kind: 'pct', def: c.mortgage.ratePct, max: 20, advanced: true },
        { id: 'priceGrowthPct', label: t('f.priceGrowth'), kind: 'pct', def: 3, max: 15, advanced: true },
        { id: 'rentGrowthPct', label: t('f.rentGrowth'), kind: 'pct', def: 3, max: 15, advanced: true },
        { id: 'investPct', label: t('f.invest'), kind: 'pct', def: R.invest, max: 20, advanced: true },
      ],
      run: v => rentVsBuy({ ...v, loanYears: 25, upkeepPct: 1, buyCostsPct: 5 }),
      view: (r, v, f) => ({
        headline: { label: t('h.rentbuy'), value: r.breakeven ? f.years(r.breakeven) : `> ${f.years(v.horizon)}` },
        sub: '',
        stats: [{ label: t('s.buyNW'), value: f.money(r.buyFinal), good: r.buyFinal >= r.rentFinal }, { label: t('s.rentNW'), value: f.money(r.rentFinal), good: r.rentFinal > r.buyFinal }, { label: t('s.pay'), value: f.money(r.payment) }],
        answer: r.breakeven ? t('a.rentbuy', { p: f.money(v.price), r: f.money(v.rent), t: f.years(r.breakeven) }) : t('a.rentbuyNever', { t: f.years(v.horizon), r: f.money(v.rent), p: f.money(v.price) }),
        insights: [{ tone: 'neutral', text: t('i.rentbuy1', { g: f.num(v.priceGrowthPct) }) }],
        chart: { yearly: true, series: [{ data: r.rentNW, tone: 'alt', dash: true }, { data: r.buyNW, tone: 'accent' }], legend: [['accent', t('l.buy')], ['alt', t('l.rent')]] },
      }),
    },

    sip: {
      fields: [
        { id: 'monthly', label: t('f.monthly'), kind: 'money', def: M(500), max: M(10000) },
        { id: 'ratePct', label: t('f.return'), kind: 'pct', def: R.invest, max: 30 },
        { id: 'years', label: t('f.years'), kind: 'years', def: 15, max: 40 },
        { id: 'stepUpPct', label: t('f.stepup'), kind: 'pct', def: 0, max: 25, advanced: true },
      ],
      run: v => sip(v),
      view: (r, v, f) => {
        const later = v.years > 5 ? sip({ ...v, years: v.years - 5 }) : null;
        const stepS = (v.stepUpPct || 0) + 10;
        const step = sip({ ...v, stepUpPct: stepS });
        return {
          headline: { label: t('h.sip'), value: f.money(r.value), num: r.value },
          sub: f.years(v.years),
          stats: [{ label: t('s.invested'), value: f.money(r.invested) }, { label: t('s.growth'), value: f.money(r.gains), good: true }, { label: '×', value: `${(r.value / Math.max(r.invested, 1)).toFixed(2)}×` }],
          answer: t('a.sip', { m: f.money(v.monthly), y: f.years(v.years), r: f.num(v.ratePct), v: f.money(r.value), g: f.money(r.gains) }),
          insights: [
            later && { tone: 'warn', text: t('i.sip1', { v: f.money(later.value), d: f.money(r.value - later.value) }) },
            { tone: 'good', text: t('i.sip2', { s: f.num(stepS), v: f.money(step.value) }) },
          ].filter(Boolean),
          chart: { series: [{ data: r.investedSeries, tone: 'alt', dash: true }, { data: r.values, tone: 'accent', fill: true }], legend: [['accent', t('l.value')], ['alt', t('l.invested')]] },
        };
      },
    },

    compound: {
      fields: [
        { id: 'principal', label: t('f.start'), kind: 'money', def: M(10000), max: M(1000000) },
        { id: 'monthly', label: t('f.add'), kind: 'money', def: M(100), max: M(10000) },
        { id: 'ratePct', label: t('f.return'), kind: 'pct', def: R.savings, max: 30 },
        { id: 'years', label: t('f.years'), kind: 'years', def: 10, max: 50 },
      ],
      run: v => compound({ ...v, perYear: 12 }),
      view: (r, v, f) => ({
        headline: { label: t('h.compound'), value: f.money(r.value), num: r.value },
        sub: f.years(v.years),
        stats: [{ label: t('s.putIn'), value: f.money(r.contributed) }, { label: t('s.interest'), value: f.money(r.interest), good: true }, { label: t('f.return'), value: f.pct(v.ratePct) }],
        answer: t('a.compound', { p: f.money(v.principal), m: f.money(v.monthly), r: f.num(v.ratePct), v: f.money(r.value), y: f.years(v.years) }),
        insights: v.ratePct > 0 ? [{ tone: 'neutral', text: t('i.compound1', { r: f.num(v.ratePct), n: f.num(Math.round((72 / v.ratePct) * 10) / 10) }) }] : [],
        chart: { series: [{ data: r.contributedSeries, tone: 'alt', dash: true }, { data: r.values, tone: 'accent', fill: true }], legend: [['accent', t('l.value')], ['alt', t('l.invested')]] },
      }),
    },

    goal: {
      fields: [
        { id: 'target', label: t('f.goal'), kind: 'money', def: M(20000), max: M(1000000) },
        { id: 'current', label: t('f.have'), kind: 'money', def: M(2000), max: M(500000) },
        { id: 'years', label: t('f.years'), kind: 'years', def: 3, max: 40 },
        { id: 'ratePct', label: t('f.return'), kind: 'pct', def: R.savings, max: 20, advanced: true },
      ],
      run: v => savingsGoal(v),
      view: (r, v, f) => {
        const longer = savingsGoal({ ...v, years: v.years + 1 });
        return {
          headline: { label: t('h.goal'), value: f.money(r.monthly), num: r.monthly },
          sub: f.date(r.months),
          stats: [{ label: t('f.goal'), value: f.money(v.target) }, { label: t('f.have'), value: f.money(v.current) }, { label: t('f.return'), value: f.pct(v.ratePct) }],
          answer: t('a.goal', { g: f.money(v.target), y: f.years(v.years), h: f.money(v.current), m: f.money(r.monthly) }),
          insights: [{ tone: 'good', text: t('i.goal1', { m: f.money(longer.monthly) }) }],
          chart: { series: [{ data: r.values, tone: 'accent', fill: true }], legend: [['accent', t('l.value')]] },
        };
      },
    },

    fd: {
      fields: [
        { id: 'principal', label: t('f.amount'), kind: 'money', def: M(10000), max: M(1000000) },
        { id: 'ratePct', label: t('f.rate'), kind: 'pct', def: R.fd, max: 20 },
        { id: 'years', label: t('f.term'), kind: 'years', def: 3, max: 10 },
      ],
      run: v => fixedDeposit({ ...v, perYear: c.fdPerYear }),
      view: (r, v, f) => ({
        headline: { label: t('h.fd'), value: f.money(r.maturity), num: r.maturity },
        sub: f.date(Math.round(v.years * 12)),
        stats: [{ label: t('s.interest'), value: f.money(r.interest), good: true }, { label: t('s.effective'), value: f.pct(r.effectivePct) }, { label: t('f.amount'), value: f.money(v.principal) }],
        answer: t('a.fd', { p: f.money(v.principal), y: f.years(v.years), r: f.num(v.ratePct), v: f.money(r.maturity), i: f.money(r.interest) }),
        insights: [{ tone: 'warn', text: t('i.fd1', { f: f.num(R.inflation), n: f.num(Math.round((v.ratePct - R.inflation) * 10) / 10) }) }],
        chart: { series: [{ data: r.values, tone: 'accent', fill: true }], legend: [['accent', t('l.value')]] },
      }),
    },

    fire: {
      fields: [
        { id: 'age', label: t('f.age'), kind: 'num', def: 30, max: 75 },
        { id: 'annualSpend', label: t('f.spend'), kind: 'money', def: M(40000), max: M(300000) },
        { id: 'savings', label: t('f.savings'), kind: 'money', def: M(50000), max: M(3000000) },
        { id: 'monthly', label: t('f.invMonthly'), kind: 'money', def: M(1500), max: M(20000) },
        { id: 'ratePct', label: t('f.return'), kind: 'pct', def: R.invest, max: 20, advanced: true },
        { id: 'inflationPct', label: t('f.inflation'), kind: 'pct', def: R.inflation, max: 15, advanced: true },
      ],
      run: v => fire({ ...v, withdrawalPct: 4 }),
      view: (r, v, f) => {
        const more = fire({ ...v, monthly: v.monthly * 1.25, withdrawalPct: 4 });
        const ok = Number.isFinite(r.years);
        return {
          headline: { label: t('h.fire'), value: r.already ? t('now') : ok ? t('age', { n: Math.round(r.age) }) : t('never') },
          sub: `${t('s.number')}: ${f.money(r.target)}`,
          stats: [
            { label: t('s.cautious'), value: Number.isFinite(r.pessimisticAge) ? t('age', { n: Math.round(r.pessimisticAge) }) : '—' },
            { label: t('s.hopeful'), value: Number.isFinite(r.optimisticAge) ? t('age', { n: Math.round(r.optimisticAge) }) : '—', good: true },
            { label: t('s.number'), value: f.money(r.target) },
          ],
          answer: ok ? t('a.fire', { s: f.money(v.annualSpend), n: f.money(r.target), m: f.money(v.monthly), r: f.num(v.ratePct), a: Math.round(r.age) })
            : t('a.fireNever', { s: f.money(v.annualSpend), n: f.money(r.target), m: f.money(v.monthly) }),
          insights: ok && Number.isFinite(more.years) && r.years > more.years ? [{ tone: 'good', text: t('i.fire1', { t: f.years(r.years - more.years) }) }] : [],
          chart: { yearly: true, series: [{ data: r.series.map(() => r.target), tone: 'alt', dash: true }, { data: r.series, tone: 'accent', fill: true }], legend: [['accent', t('l.investments')], ['alt', t('l.number')]] },
        };
      },
    },

    inflation: {
      fields: [
        { id: 'amount', label: t('f.today'), kind: 'money', def: M(1000), max: M(1000000) },
        { id: 'inflationPct', label: t('f.inflRate'), kind: 'pct', def: R.inflation, max: 30 },
        { id: 'years', label: t('f.years'), kind: 'years', def: 10, max: 50 },
      ],
      run: v => inflation(v),
      view: (r, v, f) => ({
        headline: { label: t('h.inflation'), value: f.money(r.futureCost), num: r.futureCost },
        sub: f.years(v.years),
        stats: [{ label: t('s.worth'), value: f.money(r.purchasingPower) }, { label: t('f.inflRate'), value: f.pct(v.inflationPct) }, { label: t('f.today'), value: f.money(v.amount) }],
        answer: t('a.inflation', { r: f.num(v.inflationPct), a: f.money(v.amount), v: f.money(r.futureCost), y: f.years(v.years) }),
        insights: [{ tone: 'warn', text: t('i.inflation1', { r: f.num(v.inflationPct) }) }],
        chart: { yearly: true, series: [{ data: r.values, tone: 'accent', fill: true }], legend: [['accent', t('l.value')]] },
      }),
    },
  };
}

/** Debt planner: defaults + view, shared by the app and Numi. */
export function debtDefaults(country) {
  const c = COUNTRIES[country];
  const M = base => nice(base * c.scale);
  return { budget: M(900), debts: [
    { name: 'Card A', balance: M(6500), apr: c.rates.card, min: M(160) },
    { name: 'Card B', balance: M(1800), apr: Math.round(c.rates.card * 1.2 * 10) / 10, min: M(55) },
    { name: 'Loan', balance: M(9800), apr: c.rates.loan, min: M(290) },
  ] };
}
export function debtView(debts, budget, f, t) {
  const a = debtPayoff(debts, budget, 'avalanche'), s = debtPayoff(debts, budget, 'snowball');
  const minTotal = debts.reduce((x, d) => x + d.min, 0);
  if (a.error || s.error) {
    return { error: true, headline: { label: t('h.debt'), value: t('never') }, sub: '', stats: [], answer: t('e.debt', { m: f.money(minTotal) }), insights: [], chart: null };
  }
  const total = debts.reduce((x, d) => x + d.balance, 0);
  const diff = s.totalInterest - a.totalInterest;
  const firstSnow = s.order[0];
  return {
    headline: { label: t('h.debt'), value: f.date(a.months) },
    sub: f.duration(a.months),
    stats: [{ label: t('s.ava'), value: f.money(a.totalInterest), good: diff > 1 }, { label: t('s.snow'), value: f.money(s.totalInterest) }, { label: t('d.budget'), value: f.money(budget) }],
    answer: t('a.debt', { p: f.money(budget), b: f.money(total), d: f.date(a.months), i: f.money(a.totalInterest) }),
    insights: [
      diff > 1 ? { tone: 'good', text: t('i.debt1', { s: f.money(diff) }) } : null,
      firstSnow ? { tone: 'neutral', text: t('i.debt2', { n: firstSnow.name, t: f.duration(firstSnow.month) }) } : null,
    ].filter(Boolean),
    order: a.order,
    chart: { series: [{ data: s.totals, tone: 'alt', dash: true }, { data: a.totals, tone: 'accent', fill: true }], legend: [['accent', t('s.ava')], ['alt', t('s.snow')]] },
  };
}
