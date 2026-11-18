// Numi: a rules-based money assistant. No AI, no network.
// Finds what the person is asking, pulls numbers out of the sentence,
// runs the right calculator and writes a plain-language answer.
import { COUNTRIES, fmt } from './locale.js';
import { configs, catalog } from './calcs.js';
import { amounts, parseMortgage, parseDebts } from './parser.js';
import { mortgagePayoff, debtPayoff } from './engine.js';
import { mortgageInsights } from './insights.js';

const INTENTS = [
  ['rentbuy', /\brent\b.*\bbuy\b|\bbuy\b.*\brent\b|rent or buy|rent vs/],
  ['debt', /snowball|avalanche|\bdebts\b|several (loans|cards)|multiple (loans|cards)|all my (loans|cards)/],
  ['card', /credit ?card|card balance|\bcard\b/],
  ['fire', /retire|\bfire\b|financial(ly)? independen|stop working/],
  ['fd', /\bfd\b|fixed deposit|term deposit|\bcd\b|certificate of deposit|\bgic\b|savings bond|fixed.rate bond/],
  ['sip', /\bsip\b|mutual fund|invest\w*\s+(\S+\s+){0,3}(every|per|a|each)\s+month|monthly invest|index fund/],
  ['goal', /save for|savings goal|how much (should|do|to|must)( i)? save|need to save|reach\b.*\b(by|in)\b|my target|goal of/],
  ['inflation', /inflation|purchasing power|(cost|worth) in \d+\s*(years?|yrs?)|what will .* cost/],
  ['mortgage', /mortgage|home ?loan|housing loan|house loan|overpay|prepay/],
  ['compound', /compound|lump ?sum|\bgrow\b|interest on|deposit .* (at|for)|savings account/],
  ['emi', /\bemi\b|\bloan\b|borrow|repayment|monthly payment|finance a|car/],
];

const GLOSSARY = [
  [/\bapr\b/, 'APR', 'APR (annual percentage rate) is the yearly cost of borrowing, including interest and most fees. Use it to compare loans and cards fairly.'],
  [/\bemi\b/, 'EMI', 'An EMI (equated monthly instalment) is the fixed monthly payment on a loan. Early on, most of it is interest; later, most of it repays the loan.'],
  [/\bsip\b/, 'SIP', 'A SIP (systematic investment plan) means investing a fixed amount every month, usually into a mutual fund. It builds the habit and averages out the price you pay.'],
  [/step.?up/, 'Step-up', 'A step-up raises your monthly investment by a set percentage each year, usually in line with salary rises. It makes a big difference over long periods.'],
  [/compound/, 'Compound interest', 'Compound interest is interest earned on your interest. The longer money is left alone, the faster it grows, which is why starting early matters most.'],
  [/amorti[sz]/, 'Amortization', 'Amortization is how a loan is paid down over time. Each payment covers that month\'s interest first; the rest reduces what you owe.'],
  [/principal/, 'Principal', 'The principal is the amount you borrowed (or invested), not counting interest.'],
  [/snowball/, 'Debt snowball', 'The snowball method pays off your smallest balance first, then rolls that payment into the next. Quick wins keep you motivated.'],
  [/avalanche/, 'Debt avalanche', 'The avalanche method pays off your highest-interest debt first. It always costs the same or less interest than snowball.'],
  [/\bfd\b|fixed deposit|term deposit|\bcd\b|\bgic\b/, 'Fixed deposit', 'A fixed deposit (also called a term deposit, CD or GIC) locks your money for a set term at a fixed interest rate. Safe and predictable, but usually taxable and hard to access early.'],
  [/inflation/, 'Inflation', 'Inflation is how fast prices rise. At 5% inflation, something costing 100 today costs about 163 in 10 years, so cash loses value over time.'],
  [/\bfire\b|financial independence/, 'FIRE', 'FIRE (financial independence, retire early) means saving and investing enough that your investments can cover your spending. A common target is 25 times your yearly spending.'],
  [/4 ?% rule|safe withdrawal/, 'The 4% rule', 'The 4% rule says you can usually withdraw about 4% of your investments in the first year of retirement, then adjust for inflation, with a low chance of running out over 30 years.'],
  [/rule of 72/, 'Rule of 72', 'Divide 72 by the yearly rate to estimate how many years it takes to double. At 8%, money doubles in about 9 years.'],
  [/emergency fund/, 'Emergency fund', 'An emergency fund is cash set aside for surprises, typically 3 to 6 months of essential spending, kept somewhere easy to reach.'],
  [/fixed (rate|vs)|variable rate|floating rate/, 'Fixed vs variable rates', 'A fixed rate stays the same for an agreed period, so payments are predictable. A variable (floating) rate moves with the market: it can fall or rise.'],
  [/\bltv\b|loan.to.value/, 'Loan-to-value', 'Loan-to-value (LTV) is your loan as a share of the property price. A lower LTV, meaning a bigger deposit, usually gets you a better rate.'],
  [/credit score|cibil/, 'Credit score', 'A credit score summarises how reliably you have repaid credit. Paying on time and keeping card balances low are the two biggest things that help.'],
  [/prepay|overpay/, 'Prepayment', 'Prepaying (overpaying) means paying more than your required payment. It cuts the balance sooner, so you pay less interest overall. Check for early-repayment charges.'],
];

const NAMES = {
  mortgage: 'Mortgage payoff', emi: 'Loan repayment', card: 'Credit card payoff', debt: 'Debt payoff', rentbuy: 'Rent vs buy',
  sip: 'Monthly investing', compound: 'Compound interest', goal: 'Savings goal', fd: 'Fixed deposit', fire: 'Retirement & FIRE', inflation: 'Inflation',
};

const FOLLOWUPS = {
  mortgage: ['What if I pay 200 more a month?', 'What if the rate is 1% lower?'],
  emi: ['What if the rate is 1% lower?', 'Over 3 years instead?'],
  card: ['What if I pay double?', 'What is APR?'],
  sip: ['What if I invest for 20 years?', 'What is a step-up SIP?'],
  compound: ['What if the rate is 1% higher?', 'Over 20 years instead?'],
  goal: ['What if I give it 2 more years?', 'What is an emergency fund?'],
  fd: ['What if the rate is 0.5% higher?', 'What about inflation?'],
  fire: ['What if I invest 25% more?', 'What is the 4% rule?'],
  inflation: ['Over 20 years instead?', 'What is the rule of 72?'],
  rentbuy: ['What if I stay 15 years?', 'What if rent is lower?'],
  debt: ['What is the avalanche method?', 'Open the debt planner'],
};

const pctList = t => [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|percent|pc\b|per ?cent)/g)].map(m => ({ v: parseFloat(m[1]), i: m.index }));
const yearsIn = t => { const y = t.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/); if (y) return parseFloat(y[1]); const m = t.match(/(\d+)\s*months?/); return m ? parseInt(m[1], 10) / 12 : null; };
const ageIn = t => { const m = t.match(/(?:\bage\b|\baged\b|i am|i'm|\bim\b)\s*(\d{2})\b/) || t.match(/(\d{2})\s*(?:years?|yrs?)\s*old/); return m ? parseInt(m[1], 10) : null; };

function moneyList(t, age) {
  return amounts(t).filter(a => {
    if (age && a.value === age) return false;
    const isYear = /^\d{4}$/.test(a.raw) && a.value >= 2020 && a.value <= 2100 && /(by|in|until|till)\s*$/.test(t.slice(Math.max(0, a.index - 8), a.index));
    return !isYear;
  });
}
function near(list, t, re, exclude = []) {
  const hits = [...t.matchAll(new RegExp(re, 'g'))].map(m => m.index);
  if (!hits.length) return null;
  let best = null, bestD = 1e9;
  for (const a of list) {
    if (exclude.includes(a)) continue;
    for (const h of hits) { const d = Math.abs(a.index - h); if (d < bestD && d < 40) { best = a; bestD = d; } }
  }
  return best;
}
const largest = (list, exclude = []) => list.filter(a => !exclude.includes(a)).sort((a, b) => b.value - a.value)[0] || null;

/** Pull values for one calculator out of the sentence. */
function extract(intent, t) {
  const age = ageIn(t);
  const list = moneyList(t, age);
  const pcts = pctList(t);
  const yrs = yearsIn(t);
  const v = {};
  const pct0 = pcts[0]?.v;
  switch (intent) {
    case 'mortgage': Object.assign(v, parseMortgage(t).found); break;
    case 'emi': { const a = largest(list); if (a) v.principal = a.value; if (pct0 != null) v.ratePct = pct0; if (yrs) v.years = yrs; break; }
    case 'card': {
      const pay = near(list, t, 'pay|payment|month|monthly');
      const bal = largest(list, pay ? [pay] : []);
      if (bal) v.balance = bal.value; if (pay && pay !== bal) v.payment = pay.value; if (pct0 != null) v.aprPct = pct0; break;
    }
    case 'rentbuy': {
      const rent = near(list, t, 'rent'); const price = largest(list, rent ? [rent] : []);
      if (price) v.price = price.value; if (rent && rent !== price) v.rent = rent.value; if (pct0 != null) v.ratePct = pct0; if (yrs) v.horizon = yrs; break;
    }
    case 'fire': {
      if (age) v.age = age;
      const spend = near(list, t, 'spend|expens|live on|need|cost');
      const saved = near(list, t, 'saved|have|savings|invested|portfolio|corpus', spend ? [spend] : []);
      const monthly = near(list, t, 'invest|save|put', [spend, saved].filter(Boolean));
      if (spend) { const perMonth = /month/.test(t.slice(spend.index, spend.index + 30)); v.annualSpend = perMonth ? spend.value * 12 : spend.value; }
      if (saved) v.savings = saved.value;
      if (monthly) v.monthly = monthly.value;
      if (pct0 != null) v.ratePct = pct0; break;
    }
    case 'fd': { const a = largest(list); if (a) v.principal = a.value; if (pct0 != null) v.ratePct = pct0; if (yrs) v.years = yrs; break; }
    case 'sip': {
      const a = near(list, t, 'month|sip|every') || largest(list); if (a) v.monthly = a.value;
      const kw = t.search(/step|increase|raise|top.?up/);
      const step = kw < 0 ? null : pcts.reduce((b, p) => (b === null || Math.abs(p.i - kw) < Math.abs(b.i - kw) ? p : b), null);
      const ret = pcts.find(p => p !== step);
      if (ret) v.ratePct = ret.v; if (step) v.stepUpPct = step.v; if (yrs) v.years = yrs; break;
    }
    case 'goal': {
      const cur = near(list, t, 'have|saved|already'); const tgt = largest(list, cur ? [cur] : []);
      if (tgt) v.target = tgt.value; if (cur && cur !== tgt) v.current = cur.value; if (pct0 != null) v.ratePct = pct0; if (yrs) v.years = yrs; break;
    }
    case 'inflation': { const a = largest(list); if (a) v.amount = a.value; if (pct0 != null) v.inflationPct = pct0; if (yrs) v.years = yrs; break; }
    case 'compound': {
      const mo = near(list, t, 'month|monthly'); const p = largest(list, mo ? [mo] : []);
      if (p) v.principal = p.value; if (mo && mo !== p) v.monthly = mo.value; if (pct0 != null) v.ratePct = pct0; if (yrs) v.years = yrs; break;
    }
  }
  return v;
}

/** Follow-up like "what if the rate is 1% lower" or "over 10 years instead". */
function applyFollowUp(intent, prev, t, cfg) {
  const v = { ...prev };
  const fields = intent === 'mortgage'
    ? [{ id: 'balance', kind: 'money' }, { id: 'ratePct', kind: 'pct' }, { id: 'yearsLeft', kind: 'years' }, { id: 'extra', kind: 'money' }]
    : cfg.fields;
  const rateField = fields.find(f => f.kind === 'pct');
  const yearsField = fields.find(f => f.kind === 'years');
  const moneyField = fields.find(f => f.kind === 'money');
  let changed = false;
  const rel = t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|points?|pc)?\s*(lower|less|down|higher|more|up)/);
  if (rel && /rate|interest|return|%|point|inflation/.test(t) && rateField) {
    const d = parseFloat(rel[1]) * (/lower|less|down/.test(rel[2]) ? -1 : 1);
    v[rateField.id] = Math.max(0, (v[rateField.id] || 0) + d); changed = true;
  } else {
    const p = pctList(t)[0];
    if (p && rateField) { v[rateField.id] = p.v; changed = true; }
  }
  const y = yearsIn(t);
  if (y && yearsField) { v[yearsField.id] = y; changed = true; }
  if (/double/.test(t) && moneyField) {
    const target = intent === 'card' ? 'payment' : intent === 'mortgage' ? 'extra' : moneyField.id;
    v[target] = (v[target] || 0) * 2 || v[target]; changed = true;
  }
  const pctMore = t.match(/(\d+)\s*%\s*more/);
  if (pctMore && !/rate|interest|return/.test(t)) {
    const target = intent === 'fire' ? 'monthly' : intent === 'card' ? 'payment' : moneyField?.id;
    if (target) { v[target] = (v[target] || 0) * (1 + parseInt(pctMore[1], 10) / 100); changed = true; }
  }
  const list = moneyList(t, null);
  if (list.length) {
    const extraWords = /extra|more|additional|another/.test(t);
    let target = moneyField?.id;
    if (intent === 'mortgage' && extraWords) { v.extra = (/another/.test(t) ? (v.extra || 0) : 0) + list[0].value; changed = true; target = null; }
    else if (intent === 'card' && /pay/.test(t)) target = 'payment';
    else if (intent === 'rentbuy' && /rent/.test(t)) target = 'rent';
    else if (intent === 'sip' || intent === 'fire') target = /spend/.test(t) ? 'annualSpend' : 'monthly';
    if (target) { v[target] = list[0].value; changed = true; }
  }
  if (/2 more years|two more years/.test(t) && yearsField) { v[yearsField.id] = (v[yearsField.id] || 0) + 2; changed = true; }
  if (/lower/.test(t) && /rent/.test(t) && intent === 'rentbuy' && !list.length) { v.rent = v.rent * 0.85; changed = true; }
  return changed ? v : null;
}

function link(intent, values, country) {
  const p = new URLSearchParams({ c: country });
  for (const [k, val] of Object.entries(values)) if (val !== undefined && val !== null && k !== 'compounding') p.set(k, String(Math.round(val * 100) / 100));
  if (intent === 'mortgage') return `mortgage.html?${p}`;
  if (intent === 'debt') return 'debt.html';
  p.set('id', intent);
  return `calc.html?${p}`;
}

/**
 * Main entry. ctx = { intent, values } from the previous turn.
 * Returns { title, text, stats, tips, link, chips, ctx, speak }.
 */
export function respond(input, ctx = {}, country = 'us') {
  const c = COUNTRIES[country];
  const f = fmt(country);
  const t = ` ${String(input || '').toLowerCase().replace(/[’']/g, "'")} `;
  const cfgs = configs(c);

  if (!t.trim()) return { text: 'Ask me anything about loans, savings, investing or retirement.', chips: starterChips(c), ctx };

  if (/^\s*(hi|hello|hey|namaste|hola|good (morning|evening|afternoon))\b/.test(t) && t.trim().split(/\s+/).length <= 4) {
    return { text: `Hi! I'm Numi. I work out money questions for ${c.name} in seconds, right here on your device. Try one of these, or ask your own.`, chips: starterChips(c), ctx: {} };
  }
  if (/\b(thank|thanks|great|perfect|cool)\b/.test(t) && t.trim().split(/\s+/).length <= 4) {
    return { text: 'Happy to help. Anything else you want to work out?', chips: starterChips(c), ctx };
  }
  if (/what can you do|help\b|how (do|does) (this|numi) work/.test(t)) {
    return {
      text: `I can calculate loan payments, ${c.mortgageTerm} payoff, credit cards and debt plans, ${c.terms.sip === 'SIP' ? 'SIPs' : 'monthly investing'}, compound interest, savings goals, ${c.terms.fdShort}s, retirement and inflation, and explain money terms. Just type or say your numbers in a sentence.`,
      chips: starterChips(c), ctx,
    };
  }

  // Glossary: "what is APR", "explain compound interest".
  const asksMeaning = /what('s| is| are| does)|explain|meaning|define|tell me about|how does/.test(t);
  const hasNumbers = /\d/.test(t);
  if (asksMeaning && !hasNumbers) {
    const g = GLOSSARY.find(([re]) => re.test(t));
    if (g) return { title: g[1], text: g[2], chips: ctx.intent ? (FOLLOWUPS[ctx.intent] || []).slice(0, 1).concat(starterChips(c).slice(0, 2)) : starterChips(c).slice(0, 3), ctx };
  }

  // Open a calculator by name.
  if (/^\s*(open|show|go to|take me to)\b/.test(t)) {
    const hit = INTENTS.find(([, re]) => re.test(t));
    const item = hit && catalog(c).find(x => x.id === hit[0]);
    if (item) return { title: item.name, text: `Opening the ${item.name.toLowerCase()}.`, link: { href: item.href, label: `Open ${item.name}` }, ctx, navigate: item.href };
  }

  let intent = (INTENTS.find(([, re]) => re.test(t)) || [])[0];
  let values;
  const isFollowUp = ctx.intent && (!intent || intent === ctx.intent || /^\s*(what if|and|instead|how about|what about|over|if)\b/.test(t));
  if (isFollowUp && ctx.intent !== 'debt') {
    const v = applyFollowUp(ctx.intent, ctx.values, t, cfgs[ctx.intent]);
    if (v) { intent = ctx.intent; values = v; }
  }

  if (!intent) {
    return { text: 'I didn\'t quite catch that. Try putting the numbers in a sentence, like one of these:', chips: starterChips(c), ctx };
  }

  // Debt planner (several debts).
  if (intent === 'debt') {
    const { found } = parseDebts(t);
    if (!found.debts) return { title: NAMES.debt, text: 'Tell me your total debt, the interest rate and what you can pay each month, e.g. "I owe 18k on 3 cards at 24%, can pay 900 a month". Or open the planner to enter each debt.', link: { href: 'debt.html', label: 'Open debt planner' }, chips: FOLLOWUPS.debt, ctx: { intent: 'debt' } };
    const budget = found.budget || Math.round(found.debts.reduce((s, d) => s + d.min, 0) * 1.5);
    const a = debtPayoff(found.debts, budget, 'avalanche'), s = debtPayoff(found.debts, budget, 'snowball');
    if (a.error) return { title: NAMES.debt, text: `A budget of ${f.money(budget)} doesn't cover the minimum payments. You'd need at least ${f.money(a.minTotal || 0)} a month.`, ctx: { intent: 'debt' } };
    const total = found.debts.reduce((x, d) => x + d.balance, 0);
    const p = new URLSearchParams({ c: country, b: String(budget), d: JSON.stringify(found.debts) });
    return {
      title: NAMES.debt,
      text: `Paying ${f.money(budget)} a month on ${f.money(total)} of debt, you'd be debt-free by ${f.date(a.months)} using avalanche (highest rate first), with ${f.money(a.totalInterest)} of interest.`,
      stats: [{ label: 'Debt-free', value: f.date(a.months) }, { label: 'Interest (avalanche)', value: f.money(a.totalInterest) }, { label: 'Interest (snowball)', value: f.money(s.totalInterest) }, { label: 'Months', value: f.num(a.months) }],
      tips: [`I split the total evenly and estimated minimums at 3%. Open the planner to enter each debt exactly.`],
      link: { href: `debt.html?${p}`, label: 'Open in debt planner' },
      chips: FOLLOWUPS.debt, ctx: { intent: 'debt' },
    };
  }

  // Mortgage (custom engine).
  if (intent === 'mortgage') {
    const defaults = { ...c.mortgage, extra: 0, lumpSum: 0, lumpMonth: 12 };
    const found = values ? {} : extract('mortgage', t);
    const v = values || { ...defaults, ...found };
    v.compounding = c.compounding;
    const r = mortgagePayoff(v);
    const assumed = values ? [] : ['balance', 'ratePct', 'yearsLeft'].filter(k => !(k in found));
    const ins = mortgageInsights(v, r, f, c.step);
    const text = r.plan.neverPaysOff
      ? 'With those numbers the balance never goes down. The payment is below the interest.'
      : v.extra > 0 || v.lumpSum > 0
        ? `Paying ${f.money(v.extra)} extra a month${v.lumpSum ? ` plus a ${f.money(v.lumpSum)} lump sum` : ''} on a ${f.money(v.balance)} ${c.mortgageTerm} at ${f.num(v.ratePct)}% clears it by ${f.date(r.plan.months)}: ${f.duration(r.monthsSaved)} early, saving ${f.money(r.interestSaved)} in interest.`
        : `A ${f.money(v.balance)} ${c.mortgageTerm} at ${f.num(v.ratePct)}% over ${f.num(v.yearsLeft)} years costs ${f.money(r.payment)} a month and ${f.money(r.base.totalInterest)} in interest.`;
    return {
      title: c.mortgageTitle.replace(' calculator', ''),
      text: text + assumedNote(assumed, v, f, 'mortgage'),
      stats: [{ label: 'Monthly payment', value: f.money(r.payment + (v.extra || 0)) }, { label: 'Paid off', value: f.date(r.plan.months) }, { label: 'Interest saved', value: f.money(Math.max(0, r.interestSaved)) }, { label: 'Total interest', value: f.money(r.plan.totalInterest) }],
      tips: ins.slice(0, 1).map(i => i.text),
      link: { href: link('mortgage', v, country), label: 'Open in calculator' },
      chips: FOLLOWUPS.mortgage, ctx: { intent: 'mortgage', values: v },
    };
  }

  // Generic calculators.
  const cfg = cfgs[intent];
  const defaults = Object.fromEntries(cfg.fields.map(fl => [fl.id, fl.def]));
  const found = values ? {} : extract(intent, t);
  const v = values || { ...defaults, ...found };
  const r = cfg.run(v);
  const view = cfg.view(r, v, f);
  const keyFields = cfg.fields.filter(fl => !fl.advanced).map(fl => fl.id);
  const assumed = values ? [] : keyFields.filter(k => !(k in found));
  return {
    title: cfg.title.replace(' calculator', ''),
    text: view.answer + assumedNote(assumed, v, f, intent, cfg),
    stats: view.stats,
    tips: view.insights.slice(0, 1).map(i => i.text),
    link: { href: link(intent, v, country), label: 'Open in calculator' },
    chips: FOLLOWUPS[intent], ctx: { intent, values: v },
  };
}

function assumedNote(keys, v, f, intent, cfg) {
  if (!keys.length) return '';
  const label = k => {
    const fl = cfg?.fields.find(x => x.id === k);
    const name = (fl?.label || { balance: 'balance', ratePct: 'rate', yearsLeft: 'years left' }[k] || k).toLowerCase();
    const kind = fl?.kind || (k === 'ratePct' ? 'pct' : k === 'yearsLeft' ? 'years' : 'money');
    const val = kind === 'money' ? f.money(v[k]) : kind === 'pct' ? `${f.num(v[k])}%` : kind === 'years' ? `${f.num(v[k])} years` : f.num(v[k]);
    return `${name} ${val}`;
  };
  return ` (I assumed ${keys.slice(0, 3).map(label).join(', ')}: tell me yours to refine it.)`;
}

export function starterChips(c) {
  const k = c.code === 'in';
  return [
    k ? 'EMI on 10 lakh at 10.5% for 5 years' : `Payment on a ${Math.round(25 * c.scale)}k loan at ${c.rates.loan}% for 5 years`,
    k ? 'SIP of 10k a month for 15 years at 12%' : `Invest ${Math.round(500 * c.scale)} a month for 20 years`,
    k ? '45 lakh home loan at 8.5%, 20 years, 10k extra' : `${Math.round(c.mortgage.balance / 1000)}k ${c.mortgageTerm} at ${c.mortgage.ratePct}%, ${c.mortgage.yearsLeft} years, ${c.step * 2} extra a month`,
    'When can I retire?',
    'What is compound interest?',
  ];
}
