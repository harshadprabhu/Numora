import { COUNTRIES, fmt } from './locale.js';
import { mountShell, openNumi } from './shell.js';
import { debtPayoff } from './engine.js';
import { debtInsights } from './insights.js';
import { parseDebts } from './parser.js';
import { lineChart, copyLink, readNumber } from './ui.js';

const $ = id => document.getElementById(id);
let country, f, c;

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function debtRow(d = { name: '', balance: '', apr: '', min: '' }) {
  const row = document.createElement('div');
  row.className = 'debt-row';
  row.innerHTML = `
    <input aria-label="Debt name" data-k="name" value="${esc(d.name)}" placeholder="Name">
    <input aria-label="Balance" data-k="balance" inputmode="decimal" value="${esc(d.balance)}" placeholder="Balance">
    <input aria-label="Rate per year" data-k="apr" inputmode="decimal" value="${esc(d.apr)}" placeholder="%">
    <input aria-label="Minimum payment" data-k="min" inputmode="decimal" value="${esc(d.min)}" placeholder="Min">
    <button type="button" class="icon-btn" aria-label="Remove this debt">×</button>`;
  row.querySelector('button').addEventListener('click', () => { row.remove(); render(); });
  $('debts').appendChild(row);
}

function setDefaults(list, budget) {
  c = COUNTRIES[country];
  f = fmt(country);
  document.querySelectorAll('.cur').forEach(e => (e.textContent = f.symbol));
  $('flag').textContent = c.flag;
  $('cname').textContent = c.name;
  document.querySelectorAll('.cname2').forEach(e => (e.textContent = c.name));
  $('debts').innerHTML = '';
  (list || c.debt.debts).forEach(debtRow);
  $('budget').value = budget ?? c.debt.budget;
}

function readDebts() {
  return [...document.querySelectorAll('#debts .debt-row')].map((r, i) => {
    const g = k => r.querySelector(`[data-k="${k}"]`);
    return {
      name: g('name').value.trim() || `Debt ${i + 1}`,
      balance: readNumber(g('balance')),
      apr: readNumber(g('apr')),
      min: readNumber(g('min')),
    };
  }).filter(d => d.balance > 0 && d.apr >= 0 && d.min > 0);
}

function render() {
  const debts = readDebts();
  const budget = readNumber($('budget'));
  const minTotal = debts.reduce((s, d) => s + d.min, 0);
  $('min-hint').textContent = debts.length ? `minimums: ${f.money(minTotal)}` : '';
  $('budgetRange').min = Math.floor(minTotal);
  $('budgetRange').max = Math.ceil(Math.max(minTotal * 3, budget || 0));
  $('budgetRange').value = budget || minTotal;
  if (!debts.length || !(budget > 0)) {
    $('answer').textContent = 'Add at least one debt with a balance, rate and minimum payment.';
    return;
  }
  const ava = debtPayoff(debts, budget, 'avalanche');
  const snow = debtPayoff(debts, budget, 'snowball');
  $('insights').innerHTML = debtInsights(debts, budget, { avalanche: ava, snowball: snow }, f, c.step)
    .map(i => `<div class="insight"><span class="dot ${i.tone}"></span><span>${esc(i.text)}</span></div>`).join('');
  if (ava.error || snow.error) {
    $('r-date').textContent = '—';
    $('r-sub').textContent = 'Increase your monthly budget to make progress.';
    $('answer').textContent = ava.error === 'budget-below-minimums'
      ? `Your budget of ${f.money(budget)} is below the minimum payments of ${f.money(minTotal)}.`
      : 'At this budget the total debt is not going down.';
    $('chart').innerHTML = '';
    return;
  }
  const total = debts.reduce((s, d) => s + d.balance, 0);
  $('r-date').textContent = f.date(ava.months);
  $('r-sub').textContent = `${f.duration(ava.months)} with avalanche · snowball: ${f.date(snow.months)}`;
  $('ava-int').textContent = f.money(ava.totalInterest);
  $('snow-int').textContent = f.money(snow.totalInterest);
  $('ava-time').textContent = `interest · ${f.duration(ava.months)}`;
  $('snow-time').textContent = `interest · ${f.duration(snow.months)}`;
  $('ava-order').innerHTML = ava.order.map(o => `<li>${esc(o.name)} · ${f.date(o.month)}</li>`).join('');
  $('snow-order').innerHTML = snow.order.map(o => `<li>${esc(o.name)} · ${f.date(o.month)}</li>`).join('');
  const avaBest = ava.totalInterest <= snow.totalInterest;
  $('m-ava').classList.toggle('best', avaBest);
  $('m-snow').classList.toggle('best', !avaBest);
  $('answer').textContent = `Paying ${f.money(budget)} a month on ${f.money(total)} of debt makes you debt-free by ${f.date(ava.months)} using avalanche, with ${f.money(ava.totalInterest)} of interest${snow.totalInterest - ava.totalInterest > 1 ? `, ${f.money(snow.totalInterest - ava.totalInterest)} less than snowball` : ''}.`;
  lineChart($('chart'), [
    { data: snow.totals, color: '#818cf8', dash: true },
    { data: ava.totals, color: 'var(--accent)', fill: true },
  ], { labelX: y => `Yr ${y}`, money: v => new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, notation: 'compact', maximumFractionDigits: 1 }).format(v) });
}

function params() {
  return { c: country, b: $('budget').value, d: JSON.stringify(readDebts()) };
}

// Init
const qs = Object.fromEntries(new URLSearchParams(location.search));
country = mountShell('calcs', code => { country = code; setDefaults(); render(); });
if (qs.c && COUNTRIES[qs.c]) { country = qs.c; $('country').value = qs.c; }
let fromUrl = null;
try { fromUrl = qs.d ? JSON.parse(qs.d) : null; } catch (_) { fromUrl = null; }
setDefaults(fromUrl, qs.b);
render();

let t;
$('form').addEventListener('input', e => {
  if (e.target.id === 'budgetRange') $('budget').value = e.target.value;
  clearTimeout(t); t = setTimeout(render, 40);
});
$('add').addEventListener('click', () => { debtRow(); });
$('share').addEventListener('click', () => copyLink(params()));
$('print').addEventListener('click', () => window.print());

$('nl-go').addEventListener('click', () => {
  const { found, unsure } = parseDebts($('nl').value);
  const chips = [];
  if (found.debts) { setDefaults(found.debts, found.budget ?? $('budget').value); chips.push(`<span class="chip">${found.debts.length} debt${found.debts.length > 1 ? 's' : ''} added</span>`); }
  else if (found.budget) $('budget').value = found.budget;
  if (found.budget) chips.push(`<span class="chip">Budget: ${f.money(found.budget)} / month</span>`);
  unsure.forEach(u => chips.push(`<span class="chip warn">${esc(u)}</span>`));
  $('nl-chips').innerHTML = chips.join('') || '<span class="chip warn">I could not find numbers in that. Try: "I owe 12k on 2 cards at 22%, can pay 600 a month".</span>';
  render();
});
$('nl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('nl-go').click(); } });

$('ask-numi').addEventListener('click', () => openNumi('What is the avalanche method?', { intent: 'debt' }));
