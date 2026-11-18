// Generic calculator page driven by configs in calcs.js.
import { mountShell, openNumi } from './shell.js';
import { COUNTRIES, fmt } from './locale.js';
import { configs, catalog, CATEGORIES, icon } from './calcs.js';
import { lineChart, copyLink, savePlan, readNumber, toast, formatOnBlur, animateNumber } from './ui.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const qs = Object.fromEntries(new URLSearchParams(location.search));
const id = qs.id || 'emi';
let country, c, f, cfg, item;

const PARTNER = {
  emi: 'Compare personal loan rates', card: 'Compare balance-transfer cards', rentbuy: 'Get a mortgage agreement in principle',
  sip: 'Compare investment platforms', compound: 'Compare high-interest savings accounts', goal: 'Compare high-interest savings accounts',
  fd: 'Compare fixed-term rates', fire: 'Compare low-cost investment accounts', inflation: 'Compare inflation-beating savings',
};

function unitFor(fl) {
  if (fl.unit) return fl.unit;
  return fl.kind === 'pct' ? '%' : fl.kind === 'years' ? 'years' : '';
}

function build(fromUrl) {
  c = COUNTRIES[country];
  f = fmt(country);
  const all = configs(c);
  cfg = all[id] || all.emi;
  item = catalog(c).find(x => x.id === id) || catalog(c)[1];
  document.title = `${cfg.title} — ${c.name} | Numora`;
  $('title').textContent = cfg.title;
  $('flag').textContent = c.flag;
  $('cname').textContent = c.name;
  $('cat').textContent = CATEGORIES.find(x => x.id === item.cat).name;
  $('partner').textContent = `${PARTNER[id] || 'Compare offers'} in ${c.name}.`;

  const g = new Intl.NumberFormat(c.locale, { maximumFractionDigits: 2 });
  const fieldHtml = fl => {
    const val = fromUrl && fromUrl[fl.id] !== undefined ? Number(fromUrl[fl.id]) : fl.def;
    const shown = fl.kind === 'money' ? g.format(val) : val;
    const step = fl.kind === 'money' ? Math.max(1, Math.round(fl.max / 200)) : fl.kind === 'pct' ? 0.1 : 1;
    return `<div class="field">
      <label for="${fl.id}">${esc(fl.label)} <span class="hint" id="h-${fl.id}"></span></label>
      <div class="slider-row">
        <input type="range" id="r-${fl.id}" min="0" max="${fl.max}" step="${step}" value="${Math.min(val, fl.max)}" aria-label="${esc(fl.label)} slider">
        <div class="input-row">${fl.kind === 'money' ? `<span class="unit cur" style="min-width:auto">${f.symbol}</span>` : ''}<input id="${fl.id}" type="text" inputmode="decimal" value="${shown}">${unitFor(fl) ? `<span class="unit" style="min-width:auto">${esc(unitFor(fl))}</span>` : ''}</div>
      </div>
      <div class="error" id="e-${fl.id}"></div>
    </div>`;
  };
  const basic = cfg.fields.filter(x => !x.advanced), adv = cfg.fields.filter(x => x.advanced);
  $('form').innerHTML = basic.map(fieldHtml).join('') +
    (adv.length ? `<details class="more"><summary>More options</summary>${adv.map(fieldHtml).join('')}</details>` : '');
  cfg.fields.filter(x => x.kind === 'money').forEach(fl => formatOnBlur($(fl.id), () => c.locale));

  $('related').innerHTML = catalog(c).filter(x => x.cat === item.cat && x.id !== id).slice(0, 4)
    .map(i => `<a class="cat-item" href="${i.href}${i.href.includes('?') ? '&' : '?'}c=${country}"><span class="tile-ic">${icon(i.icon)}</span><div><b>${esc(i.name)}</b><span>${esc(i.blurb)}</span></div></a>`).join('');
}

function read() {
  const v = {};
  for (const fl of cfg.fields) v[fl.id] = readNumber($(fl.id));
  return v;
}

function render() {
  const v = read();
  let bad = false;
  for (const fl of cfg.fields) {
    const x = v[fl.id];
    let msg = '';
    if (!Number.isFinite(x)) msg = 'Enter a number.';
    else if (x < 0) msg = 'Cannot be negative.';
    else if (fl.kind === 'years' && x <= 0) msg = 'Enter at least 1 year.';
    else if (fl.kind === 'pct' && x > 100) msg = 'That rate looks too high.';
    $('e-' + fl.id).textContent = msg;
    if (msg && !fl.advanced) bad = true;
    if (msg && fl.advanced) v[fl.id] = fl.def;
    if (Number.isFinite(x)) $('r-' + fl.id).value = Math.min(x, fl.max);
  }
  if (bad) return;
  const r = cfg.run(v);
  const view = cfg.view(r, v, f);
  $('r-label').textContent = view.headline.label;
  $('r-value').textContent = view.headline.value;
  $('mres-l').textContent = view.headline.label;
  $('mres-v').textContent = view.headline.value;
  $('r-sub').textContent = view.sub || '';
  $('r-stats').innerHTML = view.stats.map(s => `<div class="stat"><div class="stat-label">${esc(s.label)}</div><div class="stat-value ${s.good ? 'good' : ''}">${esc(s.value)}</div></div>`).join('');
  $('answer').textContent = view.answer;
  $('insights').innerHTML = view.insights.map(i => `<div class="insight"><span class="dot ${i.tone}"></span><span>${esc(i.text)}</span></div>`).join('');
  $('legend').innerHTML = view.chart.legend.map(([col, label]) => `<span><i style="background:${col}"></i>${esc(label)}</span>`).join('');
  const yearly = view.chart.x === 'year';
  const series = view.chart.series.map(s => ({ ...s, data: yearly ? expand(s.data) : s.data }));
  lineChart($('chart'), series, { labelX: y => `Yr ${y}`, money: x => new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, notation: 'compact', maximumFractionDigits: 1 }).format(x) });
}

/** Yearly series -> monthly points so the shared chart's year axis lines up. */
function expand(yearly) {
  const out = [];
  for (let i = 0; i < yearly.length - 1; i++) for (let m = 0; m < 12; m++) out.push(yearly[i] + (yearly[i + 1] - yearly[i]) * (m / 12));
  out.push(yearly[yearly.length - 1]);
  return out;
}

function params() {
  const p = { id, c: country };
  for (const fl of cfg.fields) p[fl.id] = String(readNumber($(fl.id)));
  return p;
}

// Init
country = mountShell('calcs', code => { country = code; build(null); render(); });
if (qs.c && COUNTRIES[qs.c]) { country = qs.c; $('country').value = qs.c; }
build(qs);
render();

let t;
$('form').addEventListener('input', e => {
  if (e.target.type === 'range') {
    const fl = cfg.fields.find(x => 'r-' + x.id === e.target.id);
    const n = Number(e.target.value);
    $(fl.id).value = fl.kind === 'money' ? new Intl.NumberFormat(c.locale).format(n) : n;
  }
  clearTimeout(t); t = setTimeout(render, 30);
});
$('form').addEventListener('submit', e => e.preventDefault());
$('share').addEventListener('click', () => copyLink(params()));
$('print').addEventListener('click', () => window.print());
$('save').addEventListener('click', () => {
  const name = `${cfg.title.replace(' calculator', '')}: ${$('r-value').textContent}`;
  const p = params();
  if (savePlan(id, name, p, { href: `calc.html?${new URLSearchParams(p)}`, title: $('answer').textContent })) toast('Saved on this device');
  else toast('Saving is blocked in this browser');
});
$('ask-numi').addEventListener('click', () => openNumi(null, { intent: id, values: read() }));
