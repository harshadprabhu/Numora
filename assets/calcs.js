// Calculator catalog + configs for the generic calculator page. Pure (no DOM).
import { emi, sip, compound, savingsGoal, fixedDeposit, fire, inflation, creditCard, rentVsBuy } from './engine.js';

/** Round to a "nice" default number. */
export function nice(v) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
}

const ICON = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  loan: 'M3 7h18v10H3zM7 12h.01M17 12h.01M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  debt: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  rent: 'M3 21V10l9-6 9 6v11M9 21v-6h6v6M17 7V4',
  sip: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  grow: 'M12 3v18M5 10l7-7 7 7',
  goal: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zM12 12h.01',
  fd: 'M4 10h16v10H4zM2 10l10-6 10 6M8 14v3M12 14v3M16 14v3',
  fire: 'M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5',
  infl: 'M3 3v18h18M7 15l4-4 3 3 6-7',
};
export const icon = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;

/** Every product, used by the home page, search and Numi. */
export function catalog(c) {
  return [
    { id: 'mortgage', cat: 'borrow', icon: 'home', href: 'mortgage.html', name: c.mortgageTitle.replace(' calculator', ''), blurb: `Extra payments, lump sums and your ${c.mortgageTerm}-free date.` },
    { id: 'emi', cat: 'borrow', icon: 'loan', href: 'calc.html?id=emi', name: c.code === 'in' ? 'EMI calculator' : 'Loan repayment', blurb: 'Monthly payment and total interest for any loan.' },
    { id: 'card', cat: 'borrow', icon: 'card', href: 'calc.html?id=card', name: 'Credit card payoff', blurb: 'How long your card balance really takes to clear.' },
    { id: 'debt', cat: 'borrow', icon: 'debt', href: 'debt.html', name: 'Debt payoff planner', blurb: 'Snowball vs avalanche, with your debt-free date.' },
    { id: 'rentbuy', cat: 'borrow', icon: 'rent', href: 'calc.html?id=rentbuy', name: 'Rent vs buy', blurb: 'The year buying starts to beat renting.' },
    { id: 'sip', cat: 'grow', icon: 'sip', href: 'calc.html?id=sip', name: c.code === 'in' ? 'SIP calculator' : 'Monthly investing', blurb: 'What regular investing grows into, with step-ups.' },
    { id: 'compound', cat: 'grow', icon: 'grow', href: 'calc.html?id=compound', name: 'Compound interest', blurb: 'Grow a lump sum, with or without monthly top-ups.' },
    { id: 'goal', cat: 'grow', icon: 'goal', href: 'calc.html?id=goal', name: 'Savings goal', blurb: 'How much to put away each month to get there.' },
    { id: 'fd', cat: 'grow', icon: 'fd', href: 'calc.html?id=fd', name: `${c.terms.fdShort.toUpperCase() === c.terms.fdShort ? c.terms.fdShort : c.terms.fdShort[0].toUpperCase() + c.terms.fdShort.slice(1)} calculator`, blurb: `Maturity value and interest on a ${c.terms.fdShort}.` },
    { id: 'fire', cat: 'plan', icon: 'fire', href: 'calc.html?id=fire', name: 'Retirement & FIRE', blurb: 'Your number, and the age you could get there.' },
    { id: 'inflation', cat: 'plan', icon: 'infl', href: 'calc.html?id=inflation', name: 'Inflation', blurb: 'What things will cost, and what money will be worth.' },
  ];
}
export const CATEGORIES = [
  { id: 'borrow', name: 'Borrowing & debt' },
  { id: 'grow', name: 'Saving & investing' },
  { id: 'plan', name: 'Planning' },
];

const money = (base, c) => nice(base * c.scale);

/**
 * Generic calculator configs. fields: kind = money | pct | years | num.
 * view() returns everything the page and Numi need to present a result.
 */
export function configs(c) {
  const R = c.rates;
  return {
    emi: {
      title: c.code === 'in' ? 'EMI calculator' : 'Loan repayment calculator',
      fields: [
        { id: 'principal', label: 'Loan amount', kind: 'money', def: money(25000, c), max: money(500000, c) },
        { id: 'ratePct', label: 'Interest rate', kind: 'pct', def: R.loan, max: 30 },
        { id: 'years', label: 'Loan term', kind: 'years', def: 5, max: 30 },
      ],
      run: v => emi(v),
      view: (r, v, f) => ({
        headline: { label: c.code === 'in' ? 'Your EMI' : 'Monthly payment', value: f.money(r.emi) },
        sub: `for ${f.duration(r.months)}`,
        stats: [
          { label: 'Total interest', value: f.money(r.totalInterest) },
          { label: 'Total paid', value: f.money(r.totalPaid) },
          { label: 'Interest share', value: `${Math.round((r.totalInterest / r.totalPaid) * 100)}%` },
          { label: 'Rate', value: `${f.num(v.ratePct)}%` },
        ],
        answer: `A ${f.money(v.principal)} loan at ${f.num(v.ratePct)}% over ${f.num(v.years)} years costs ${f.money(r.emi)} a month and ${f.money(r.totalInterest)} in interest.`,
        insights: (() => {
          const out = [];
          const shorter = v.years > 1 ? emi({ ...v, years: v.years - 1 }) : null;
          if (shorter) out.push({ tone: 'good', text: `One year shorter: ${f.money(shorter.emi)} a month, but ${f.money(r.totalInterest - shorter.totalInterest)} less interest overall.` });
          const lower = v.ratePct > 1 ? emi({ ...v, ratePct: v.ratePct - 1 }) : null;
          if (lower) out.push({ tone: 'good', text: `A rate 1 point lower saves ${f.money(r.totalInterest - lower.totalInterest)} in interest.` });
          const longer = emi({ ...v, years: v.years + 2 });
          out.push({ tone: 'neutral', text: `Stretching to ${f.num(v.years + 2)} years lowers the payment to ${f.money(longer.emi)}, but adds ${f.money(longer.totalInterest - r.totalInterest)} of interest.` });
          return out;
        })(),
        chart: { series: [{ data: r.balances, color: 'var(--accent)', fill: true }], legend: [['var(--accent)', 'Balance left']] },
      }),
    },

    card: {
      title: 'Credit card payoff calculator',
      fields: [
        { id: 'balance', label: 'Card balance', kind: 'money', def: money(5000, c), max: money(50000, c) },
        { id: 'aprPct', label: 'Interest rate (APR)', kind: 'pct', def: R.card, max: 60 },
        { id: 'payment', label: 'Monthly payment', kind: 'money', def: money(200, c), max: money(5000, c) },
      ],
      run: v => creditCard({ ...v, targetMonths: 24 }),
      view: (r, v, f) => ({
        headline: { label: 'Card cleared by', value: r.neverPaysOff ? 'Never' : f.date(r.months) },
        sub: r.neverPaysOff ? `Your payment is below the ${f.money(r.minInterest)} of interest added each month.` : `${f.duration(r.months)} from now`,
        stats: [
          { label: 'Total interest', value: r.neverPaysOff ? '—' : f.money(r.totalInterest) },
          { label: 'Clear in 2 years', value: `${f.money(r.paymentForTarget)}/mo` },
          { label: 'Interest this month', value: f.money(r.minInterest) },
          { label: 'APR', value: `${f.num(v.aprPct)}%` },
        ],
        answer: r.neverPaysOff
          ? `Paying ${f.money(v.payment)} a month on a ${f.money(v.balance)} balance at ${f.num(v.aprPct)}% never clears it: the interest is ${f.money(r.minInterest)} a month.`
          : `Paying ${f.money(v.payment)} a month clears a ${f.money(v.balance)} card balance at ${f.num(v.aprPct)}% in ${f.duration(r.months)}, costing ${f.money(r.totalInterest)} in interest.`,
        insights: (() => {
          const out = [];
          const more = creditCard({ ...v, payment: v.payment * 1.5 });
          if (!r.neverPaysOff && !more.neverPaysOff) out.push({ tone: 'good', text: `Paying ${f.money(v.payment * 1.5)} instead clears it ${f.duration(r.months - more.months)} sooner and saves ${f.money(r.totalInterest - more.totalInterest)}.` });
          out.push({ tone: 'good', text: `To be card-debt-free in 2 years, pay ${f.money(r.paymentForTarget)} a month.` });
          if (v.aprPct >= 18) out.push({ tone: 'warn', text: `At ${f.num(v.aprPct)}% this is usually your most expensive debt. Clear it before investing.` });
          return out;
        })(),
        chart: { series: [{ data: r.balances, color: 'var(--accent)', fill: true }], legend: [['var(--accent)', 'Balance left']] },
      }),
    },

    rentbuy: {
      title: 'Rent vs buy calculator',
      fields: [
        { id: 'price', label: 'Home price', kind: 'money', def: money(400000, c), max: money(3000000, c) },
        { id: 'depositPct', label: 'Deposit', kind: 'pct', def: 20, max: 60, unit: '% of price' },
        { id: 'ratePct', label: `${c.mortgageTerm[0].toUpperCase() + c.mortgageTerm.slice(1)} rate`, kind: 'pct', def: c.mortgage.ratePct, max: 20 },
        { id: 'rent', label: 'Monthly rent for a similar home', kind: 'money', def: money(1800, c), max: money(15000, c) },
        { id: 'horizon', label: 'How long you\'ll stay', kind: 'years', def: 10, max: 30 },
        { id: 'priceGrowthPct', label: 'Home price growth', kind: 'pct', def: 3, max: 15, advanced: true },
        { id: 'rentGrowthPct', label: 'Rent growth', kind: 'pct', def: 3, max: 15, advanced: true },
        { id: 'investPct', label: 'Return on invested savings', kind: 'pct', def: R.invest, max: 20, advanced: true },
        { id: 'buyCostsPct', label: 'Buying costs (taxes, fees)', kind: 'pct', def: c.code === 'in' ? 7 : 5, max: 15, advanced: true },
      ],
      run: v => rentVsBuy({ ...v, loanYears: 25, upkeepPct: 1 }),
      view: (r, v, f) => {
        const buyWins = r.buyFinal >= r.rentFinal;
        return {
          headline: { label: 'Buying pays off after', value: r.breakeven ? `${r.breakeven} yr${r.breakeven === 1 ? '' : 's'}` : `> ${v.horizon} yrs` },
          sub: buyWins ? `After ${v.horizon} years, buying leaves you ${f.money(r.buyFinal - r.rentFinal)} better off.` : `Over ${v.horizon} years, renting and investing leaves you ${f.money(r.rentFinal - r.buyFinal)} better off.`,
          stats: [
            { label: 'Net worth if you buy', value: f.money(r.buyFinal) },
            { label: 'Net worth if you rent', value: f.money(r.rentFinal) },
            { label: `${c.mortgageTerm[0].toUpperCase() + c.mortgageTerm.slice(1)} payment`, value: f.money(r.payment) },
            { label: 'Rent today', value: f.money(v.rent) },
          ],
          answer: r.breakeven
            ? `Buying a ${f.money(v.price)} home beats renting at ${f.money(v.rent)} a month after about ${r.breakeven} years, assuming ${f.num(v.priceGrowthPct)}% price growth and ${f.num(v.investPct)}% returns on savings.`
            : `Over ${v.horizon} years, renting at ${f.money(v.rent)} and investing the difference beats buying a ${f.money(v.price)} home under these assumptions.`,
          insights: [
            { tone: 'neutral', text: 'Both sides invest their spare cash, so this compares wealth, not just monthly cost.' },
            { tone: buyWins ? 'good' : 'warn', text: `The result is most sensitive to home price growth (${f.num(v.priceGrowthPct)}%). Try changing it under More options.` },
            { tone: 'neutral', text: `Buying costs of ${f.num(v.buyCostsPct)}% (${f.money(v.price * v.buyCostsPct / 100)}) are lost on day one, which is why short stays usually favour renting.` },
          ],
          chart: { x: 'year', series: [{ data: r.rentNW, color: '#818cf8', dash: true }, { data: r.buyNW, color: 'var(--accent)' }], legend: [['var(--accent)', 'Buy'], ['#818cf8', 'Rent & invest']] },
        };
      },
    },

    sip: {
      title: c.code === 'in' ? 'SIP calculator' : 'Monthly investing calculator',
      fields: [
        { id: 'monthly', label: 'Invest each month', kind: 'money', def: money(500, c), max: money(10000, c) },
        { id: 'ratePct', label: 'Expected return', kind: 'pct', def: R.invest, max: 25, unit: '% / yr' },
        { id: 'years', label: 'For', kind: 'years', def: 15, max: 40 },
        { id: 'stepUpPct', label: 'Increase each year (step-up)', kind: 'pct', def: 0, max: 25, advanced: true },
      ],
      run: v => sip(v),
      view: (r, v, f) => ({
        headline: { label: 'Expected value', value: f.money(r.value) },
        sub: `after ${f.num(v.years)} years`,
        stats: [
          { label: 'You invest', value: f.money(r.invested) },
          { label: 'Growth', value: f.money(r.gains), good: true },
          { label: 'Growth multiple', value: `${(r.value / r.invested).toFixed(2)}×` },
          { label: 'Step-up', value: `${f.num(v.stepUpPct)}% / yr` },
        ],
        answer: `Investing ${f.money(v.monthly)} a month for ${f.num(v.years)} years at ${f.num(v.ratePct)}% a year could grow to about ${f.money(r.value)}, of which ${f.money(r.gains)} is growth.`,
        insights: (() => {
          const out = [];
          const later = sip({ ...v, years: Math.max(1, v.years - 5) });
          if (v.years > 5) out.push({ tone: 'warn', text: `Starting 5 years later would leave you with ${f.money(later.value)}, ${f.money(r.value - later.value)} less.` });
          const step = sip({ ...v, stepUpPct: (v.stepUpPct || 0) + 10 });
          out.push({ tone: 'good', text: `Raising the amount by ${f.num((v.stepUpPct || 0) + 10)}% each year would grow it to ${f.money(step.value)}.` });
          out.push({ tone: 'neutral', text: 'Returns are not guaranteed; markets go up and down. Try a lower rate to see a cautious case.' });
          return out;
        })(),
        chart: { series: [{ data: r.investedSeries, color: '#818cf8', dash: true }, { data: r.values, color: 'var(--accent)', fill: true }], legend: [['var(--accent)', 'Value'], ['#818cf8', 'Amount invested']] },
      }),
    },

    compound: {
      title: 'Compound interest calculator',
      fields: [
        { id: 'principal', label: 'Starting amount', kind: 'money', def: money(10000, c), max: money(1000000, c) },
        { id: 'monthly', label: 'Add each month', kind: 'money', def: money(100, c), max: money(10000, c) },
        { id: 'ratePct', label: 'Interest / return', kind: 'pct', def: R.savings, max: 25, unit: '% / yr' },
        { id: 'years', label: 'For', kind: 'years', def: 10, max: 50 },
        { id: 'perYear', label: 'Compounded times a year', kind: 'num', def: 12, max: 365, advanced: true },
      ],
      run: v => compound(v),
      view: (r, v, f) => ({
        headline: { label: 'Final balance', value: f.money(r.value) },
        sub: `after ${f.num(v.years)} years`,
        stats: [
          { label: 'You put in', value: f.money(r.contributed) },
          { label: 'Interest earned', value: f.money(r.interest), good: true },
          { label: 'Doubles every', value: v.ratePct > 0 ? `~${f.num(Math.round((72 / v.ratePct) * 10) / 10)} yrs` : '—' },
          { label: 'Rate', value: `${f.num(v.ratePct)}%` },
        ],
        answer: `${f.money(v.principal)} plus ${f.money(v.monthly)} a month at ${f.num(v.ratePct)}% grows to ${f.money(r.value)} in ${f.num(v.years)} years, including ${f.money(r.interest)} of interest.`,
        insights: [
          { tone: 'neutral', text: `Rule of 72: at ${f.num(v.ratePct)}% money roughly doubles every ${v.ratePct > 0 ? f.num(Math.round((72 / v.ratePct) * 10) / 10) : '∞'} years.` },
          (() => { const x = compound({ ...v, years: v.years + 5 }); return { tone: 'good', text: `Leaving it 5 more years takes it to ${f.money(x.value)}.` }; })(),
          (() => { const x = compound({ ...v, monthly: v.monthly * 2 }); return { tone: 'good', text: `Doubling the monthly top-up to ${f.money(v.monthly * 2)} ends at ${f.money(x.value)}.` }; })(),
        ],
        chart: { series: [{ data: r.contributedSeries, color: '#818cf8', dash: true }, { data: r.values, color: 'var(--accent)', fill: true }], legend: [['var(--accent)', 'Balance'], ['#818cf8', 'Money put in']] },
      }),
    },

    goal: {
      title: 'Savings goal calculator',
      fields: [
        { id: 'target', label: 'Goal amount', kind: 'money', def: money(20000, c), max: money(1000000, c) },
        { id: 'current', label: 'Already saved', kind: 'money', def: money(2000, c), max: money(500000, c) },
        { id: 'years', label: 'In', kind: 'years', def: 3, max: 40 },
        { id: 'ratePct', label: 'Interest / return', kind: 'pct', def: R.savings, max: 20, unit: '% / yr' },
      ],
      run: v => savingsGoal(v),
      view: (r, v, f) => ({
        headline: { label: 'Save each month', value: f.money(r.monthly) },
        sub: `to reach ${f.money(v.target)} by ${f.date(r.months)}`,
        stats: [
          { label: 'Total you add', value: f.money(r.totalDeposits) },
          { label: 'Interest helps with', value: f.money(Math.max(0, v.target - v.current - r.totalDeposits)), good: true },
          { label: 'Already saved', value: f.money(v.current) },
          { label: 'Months', value: f.num(r.months) },
        ],
        answer: `To reach ${f.money(v.target)} in ${f.num(v.years)} years with ${f.money(v.current)} already saved, put away about ${f.money(r.monthly)} a month at ${f.num(v.ratePct)}%.`,
        insights: [
          (() => { const x = savingsGoal({ ...v, years: v.years + 1 }); return { tone: 'good', text: `Giving yourself one more year lowers it to ${f.money(x.monthly)} a month.` }; })(),
          { tone: 'neutral', text: `That's about ${f.money(r.monthly / 4.33)} a week, or ${f.money(r.monthly / 30.4)} a day.` },
          { tone: 'good', text: 'Set up an automatic transfer on payday so the saving happens before spending.' },
        ],
        chart: { series: [{ data: r.values, color: 'var(--accent)', fill: true }], legend: [['var(--accent)', 'Savings']] },
      }),
    },

    fd: {
      title: `${c.terms.fd} calculator`,
      fields: [
        { id: 'principal', label: 'Deposit amount', kind: 'money', def: money(10000, c), max: money(1000000, c) },
        { id: 'ratePct', label: 'Interest rate', kind: 'pct', def: R.fd, max: 15, unit: '% / yr' },
        { id: 'years', label: 'Term', kind: 'years', def: 3, max: 10 },
        { id: 'perYear', label: 'Compounded times a year', kind: 'num', def: c.fdPerYear, max: 12, advanced: true },
      ],
      run: v => fixedDeposit(v),
      view: (r, v, f) => ({
        headline: { label: 'Maturity value', value: f.money(r.maturity) },
        sub: `on ${f.date(Math.round(v.years * 12))}`,
        stats: [
          { label: 'Interest earned', value: f.money(r.interest), good: true },
          { label: 'Effective yearly rate', value: `${f.num(Math.round(r.effectivePct * 100) / 100)}%` },
          { label: 'Deposit', value: f.money(v.principal) },
          { label: 'Term', value: `${f.num(v.years)} yrs` },
        ],
        answer: `${f.money(v.principal)} in a ${f.num(v.years)}-year ${c.terms.fdShort} at ${f.num(v.ratePct)}% matures at ${f.money(r.maturity)}, earning ${f.money(r.interest)} before tax.`,
        insights: [
          { tone: 'neutral', text: 'Interest is usually taxable, so your take-home return is lower than shown.' },
          { tone: 'warn', text: `If inflation is ${f.num(c.rates.inflation)}%, the real return is roughly ${f.num(Math.round((v.ratePct - c.rates.inflation) * 10) / 10)}% a year.` },
          (() => { const x = fixedDeposit({ ...v, ratePct: v.ratePct + 0.5 }); return { tone: 'good', text: `Finding 0.5% more interest adds ${f.money(x.interest - r.interest)} over the term.` }; })(),
        ],
        chart: { series: [{ data: r.values, color: 'var(--accent)', fill: true }], legend: [['var(--accent)', 'Value']] },
      }),
    },

    fire: {
      title: 'Retirement & FIRE calculator',
      fields: [
        { id: 'age', label: 'Your age', kind: 'num', def: 30, max: 80, unit: 'years' },
        { id: 'annualSpend', label: 'Yearly spending in retirement (today\'s money)', kind: 'money', def: money(40000, c), max: money(300000, c) },
        { id: 'savings', label: 'Invested so far', kind: 'money', def: money(50000, c), max: money(3000000, c) },
        { id: 'monthly', label: 'Invest each month', kind: 'money', def: money(1500, c), max: money(20000, c) },
        { id: 'ratePct', label: 'Expected return', kind: 'pct', def: R.invest, max: 20, unit: '% / yr' },
        { id: 'inflationPct', label: 'Inflation', kind: 'pct', def: R.inflation, max: 15, advanced: true },
        { id: 'withdrawalPct', label: 'Safe withdrawal rate', kind: 'pct', def: 4, max: 8, advanced: true },
      ],
      run: v => fire(v),
      view: (r, v, f) => ({
        headline: { label: 'Financially independent at', value: r.already ? 'Now' : Number.isFinite(r.years) ? `Age ${Math.round(r.age)}` : 'Not reached' },
        sub: `Your number: ${f.money(r.target)} (in today's money)`,
        stats: [
          { label: 'Cautious case', value: Number.isFinite(r.pessimisticAge) ? `Age ${Math.round(r.pessimisticAge)}` : '—' },
          { label: 'Hopeful case', value: Number.isFinite(r.optimisticAge) ? `Age ${Math.round(r.optimisticAge)}` : '—', good: true },
          { label: 'Years to go', value: Number.isFinite(r.years) ? f.num(r.years) : '—' },
          { label: 'Withdrawal rate', value: `${f.num(v.withdrawalPct)}%` },
        ],
        answer: Number.isFinite(r.years)
          ? `To spend ${f.money(v.annualSpend)} a year, you need about ${f.money(r.target)}. Investing ${f.money(v.monthly)} a month at ${f.num(v.ratePct)}% gets you there around age ${Math.round(r.age)}.`
          : `To spend ${f.money(v.annualSpend)} a year you need about ${f.money(r.target)}; at ${f.money(v.monthly)} a month you don't reach it within 70 years.`,
        insights: (() => {
          const out = [];
          const more = fire({ ...v, monthly: v.monthly * 1.25 });
          if (Number.isFinite(more.years) && Number.isFinite(r.years)) out.push({ tone: 'good', text: `Investing 25% more (${f.money(v.monthly * 1.25)} a month) brings it forward ${r.years - more.years} year${r.years - more.years === 1 ? '' : 's'}.` });
          const less = fire({ ...v, annualSpend: v.annualSpend * 0.9 });
          if (Number.isFinite(less.years) && Number.isFinite(r.years)) out.push({ tone: 'good', text: `Planning to spend 10% less lowers your number to ${f.money(less.target)} and saves ${r.years - less.years} year${r.years - less.years === 1 ? '' : 's'}.` });
          out.push({ tone: 'neutral', text: `Shown as a range: ${f.num(v.ratePct - 2)}% to ${f.num(v.ratePct + 2)}% returns. Real markets vary year to year.` });
          return out;
        })(),
        chart: { x: 'year', series: [{ data: r.series.map(() => r.target), color: '#818cf8', dash: true }, { data: r.series, color: 'var(--accent)', fill: true }], legend: [['var(--accent)', 'Your investments (today\'s money)'], ['#818cf8', 'Your number']] },
      }),
    },

    inflation: {
      title: 'Inflation calculator',
      fields: [
        { id: 'amount', label: 'Amount today', kind: 'money', def: money(1000, c), max: money(1000000, c) },
        { id: 'inflationPct', label: 'Inflation rate', kind: 'pct', def: R.inflation, max: 20, unit: '% / yr' },
        { id: 'years', label: 'Years from now', kind: 'years', def: 10, max: 50 },
      ],
      run: v => inflation(v),
      view: (r, v, f) => ({
        headline: { label: `Will cost in ${f.num(v.years)} years`, value: f.money(r.futureCost) },
        sub: `${f.money(v.amount)} today`,
        stats: [
          { label: `${f.money(v.amount)} will be worth`, value: f.money(r.purchasingPower) },
          { label: 'Prices rise by', value: `${Math.round((r.futureCost / v.amount - 1) * 100)}%` },
          { label: 'Prices double every', value: v.inflationPct > 0 ? `~${f.num(Math.round((72 / v.inflationPct) * 10) / 10)} yrs` : '—' },
          { label: 'Inflation', value: `${f.num(v.inflationPct)}%` },
        ],
        answer: `At ${f.num(v.inflationPct)}% inflation, something costing ${f.money(v.amount)} today will cost about ${f.money(r.futureCost)} in ${f.num(v.years)} years, and ${f.money(v.amount)} kept as cash will buy only ${f.money(r.purchasingPower)} of today's goods.`,
        insights: [
          { tone: 'warn', text: `Savings earning less than ${f.num(v.inflationPct)}% are losing buying power each year.` },
          { tone: 'neutral', text: 'Use this to set future goals: school fees, a car or retirement spending all grow with inflation.' },
        ],
        chart: { x: 'year', series: [{ data: r.values, color: 'var(--accent)', fill: true }], legend: [['var(--accent)', 'Cost over time']] },
      }),
    },
  };
}
