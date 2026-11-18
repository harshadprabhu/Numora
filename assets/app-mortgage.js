import { COUNTRIES, fmt, mountCountrySwitcher, mountThemeToggle } from './locale.js';
import { mortgagePayoff, validateMortgage, solveExtraForTarget } from './engine.js';
import { mortgageInsights } from './insights.js';
import { parseMortgage } from './parser.js';
import { lineChart, animateNumber, copyLink, savePlan, loadPlans, deletePlan, readNumber, toast, formatOnBlur } from './ui.js';

const $ = id => document.getElementById(id);
const FIELDS = ['balance', 'ratePct', 'yearsLeft', 'extra', 'lumpSum', 'lumpMonth'];
let country, f, c;

mountThemeToggle();

function setDefaults(fromUrl) {
  c = COUNTRIES[country];
  f = fmt(country);
  document.querySelectorAll('.cur').forEach(e => (e.textContent = f.symbol));
  $('flag').textContent = c.flag;
  document.querySelector('h1').textContent = c.mortgageTitle;
  document.title = `${c.mortgageTitle} — ${c.name} | Numora`;
  $('nl').placeholder = `e.g. ${c.nlExample}`;
  document.querySelector('label[for="balance"] .hint').textContent = c.balanceHint;
  $('cname').textContent = c.name;
  document.querySelectorAll('.cname2').forEach(e => (e.textContent = c.name));
  $('compound-note').textContent = c.compounding === 'semiannual'
    ? 'Canada: fixed-rate mortgages compound semi-annually, and this calculator applies that.'
    : '';
  $('local-rule').textContent = c.compounding === 'semiannual'
    ? 'Canadian rule applied: fixed-rate mortgages compound twice a year, so the monthly rate is (1 + rate ÷ 2)^(1/6) − 1 rather than rate ÷ 12.'
    : `${c.name}: interest is applied monthly at the yearly rate ÷ 12, the usual convention for ${c.mortgageTerm}s here.`;
  const d = { ...c.mortgage, extra: c.step * 2, lumpSum: 0, lumpMonth: 12 };
  const p = fromUrl || {};
  const g = new Intl.NumberFormat(c.locale, { maximumFractionDigits: 2 });
  for (const k of FIELDS) $(k).value = p[k] ?? (['balance', 'extra', 'lumpSum'].includes(k) ? g.format(d[k]) : d[k]);
  $('extraRange').max = c.step * 30;
  $('extraRange').step = c.step / 4;
}

function read() {
  const v = {};
  for (const k of FIELDS) v[k] = readNumber($(k));
  v.extra = Number.isFinite(v.extra) ? v.extra : 0;
  v.lumpSum = Number.isFinite(v.lumpSum) ? v.lumpSum : 0;
  v.lumpMonth = Number.isFinite(v.lumpMonth) ? Math.max(1, Math.round(v.lumpMonth)) : 12;
  v.compounding = c.compounding;
  return v;
}

function render() {
  const inputs = read();
  const errs = validateMortgage(inputs);
  for (const k of ['balance', 'ratePct', 'yearsLeft', 'extra']) $('e-' + k).textContent = errs[k] || '';
  if (Object.keys(errs).length) return;
  $('extraRange').value = Math.min(inputs.extra, Number($('extraRange').max));
  $('extra-show').textContent = inputs.extra > 0 ? `${f.money(inputs.extra)} / month` : '';

  const r = mortgagePayoff(inputs);
  const never = r.plan.neverPaysOff;
  $('r-date').textContent = never ? 'Never' : f.date(r.plan.months);
  $('r-sub').textContent = never ? 'The payment does not cover the interest.' :
    `${f.duration(r.plan.months)} from now · minimum-payment plan ends ${f.date(r.base.months)}`;
  animateNumber($('r-saved'), Math.max(0, r.interestSaved), f.money);
  $('r-time').textContent = r.monthsSaved > 0 ? f.duration(r.monthsSaved) : '—';
  $('r-pay').textContent = f.money(r.payment + inputs.extra);
  animateNumber($('r-int'), r.plan.totalInterest, f.money);

  $('answer').textContent = never
    ? 'With these numbers the balance never goes down: increase the payment or check the rate.'
    : inputs.extra > 0 || inputs.lumpSum > 0
      ? `Paying ${f.money(inputs.extra)} extra a month${inputs.lumpSum ? ` plus a ${f.money(inputs.lumpSum)} lump sum` : ''} on a ${f.money(inputs.balance)} ${c.mortgageTerm} at ${f.num(inputs.ratePct)}% clears it by ${f.date(r.plan.months)}, ${f.duration(r.monthsSaved)} early, saving ${f.money(r.interestSaved)} in interest.`
      : `A ${f.money(inputs.balance)} ${c.mortgageTerm} at ${f.num(inputs.ratePct)}% over ${f.num(inputs.yearsLeft)} years costs ${f.money(r.payment)} a month and ${f.money(r.base.totalInterest)} in total interest.`;

  $('insights').innerHTML = mortgageInsights(inputs, r, f, c.step)
    .map(i => `<div class="insight"><span class="dot ${i.tone}"></span><span>${i.text}</span></div>`).join('');

  lineChart($('chart'), [
    { data: r.base.balances, color: 'var(--muted)', dash: true },
    { data: r.plan.balances, color: 'var(--accent)', fill: true },
  ], { labelX: y => `Yr ${y}`, money: v => compact(v) });

  const rows = [];
  for (let y = 1; y <= Math.ceil(r.base.months / 12); y++) {
    const b = r.base.balances[Math.min(y * 12, r.base.balances.length - 1)];
    const p = r.plan.balances[Math.min(y * 12, r.plan.balances.length - 1)] ?? 0;
    rows.push(`<tr><td>Year ${y}</td><td>${f.money(b)}</td><td>${f.money(p)}</td></tr>`);
  }
  $('schedule').innerHTML = `<thead><tr><th>End of</th><th>Minimum plan</th><th>Your plan</th></tr></thead><tbody>${rows.join('')}</tbody>`;
}

function compact(v) {
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

function params() {
  const p = { c: country };
  for (const k of FIELDS) p[k] = $(k).value;
  return p;
}

function renderPlans() {
  const plans = loadPlans('mortgage');
  $('plans').innerHTML = plans.map(p =>
    `<li><a href="?${new URLSearchParams(p.params)}">${p.name}</a><button class="icon-btn" style="width:28px;height:28px" data-at="${p.at}" aria-label="Delete ${p.name}">×</button></li>`).join('');
  $('plans').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { deletePlan('mortgage', Number(b.dataset.at)); renderPlans(); }));
}

// Init
['balance', 'extra', 'lumpSum'].forEach(id => formatOnBlur($(id), () => c.locale));
const qs = Object.fromEntries(new URLSearchParams(location.search));
country = mountCountrySwitcher(code => { country = code; setDefaults(); render(); });
if (qs.c && COUNTRIES[qs.c]) { country = qs.c; $('country').value = qs.c; }
setDefaults(Object.keys(qs).length ? qs : null);
render();
renderPlans();

let t;
$('form').addEventListener('input', e => {
  if (e.target.id === 'extraRange') $('extra').value = e.target.value;
  clearTimeout(t); t = setTimeout(render, 40);
});
$('form').addEventListener('submit', e => e.preventDefault());

$('nl-go').addEventListener('click', () => {
  const { found, unsure } = parseMortgage($('nl').value);
  const labels = { balance: 'Balance', ratePct: 'Rate', yearsLeft: 'Years left', extra: 'Extra / month', lumpSum: 'Lump sum' };
  const chips = [];
  for (const [k, v] of Object.entries(found)) {
    $(k).value = v;
    chips.push(`<span class="chip">${labels[k]}: ${k === 'ratePct' ? v + '%' : k === 'yearsLeft' ? v + ' yrs' : f.money(v)}</span>`);
  }
  unsure.forEach(u => chips.push(`<span class="chip warn">${u}</span>`));
  $('nl-chips').innerHTML = chips.join('') || '<span class="chip warn">I could not find numbers in that. Try: "250k at 5% for 20 years".</span>';
  render();
});
$('nl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('nl-go').click(); } });

$('solve').addEventListener('click', () => {
  const years = readNumber($('goal'));
  const inputs = read();
  if (!(years > 0)) { $('goal-out').textContent = 'Enter a number of years.'; return; }
  const x = solveExtraForTarget({ ...inputs, lumpSum: 0 }, Math.round(years * 12));
  $('goal-out').textContent = x === 0
    ? `You're already on track to finish within ${years} years.`
    : `Pay ${f.money(x)} extra a month to be mortgage-free in ${years} years. Applied above.`;
  if (x > 0) { $('extra').value = x; render(); }
});

$('share').addEventListener('click', () => copyLink(params()));
$('print').addEventListener('click', () => window.print());
$('save').addEventListener('click', () => {
  const i = read();
  const name = `${f.money(i.balance)} at ${i.ratePct}% + ${f.money(i.extra)}/mo`;
  if (savePlan('mortgage', name, params())) { renderPlans(); toast('Saved on this device'); }
  else toast('Saving is blocked in this browser');
});
