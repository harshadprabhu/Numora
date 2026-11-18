// Numora app: single screen, hash routing (#calc?params), network-based localization.
import { COUNTRIES, LANGS, detectFromNetwork, pickLanguage, countryName, languageName, flagOf } from './countries.js';
import { makeT, RTL } from './i18n.js';
import { configs, fmt, calcName, ICONS, ORDER, debtDefaults, debtView, nice } from './calcs.js';
import { parseAmount } from './parser.js';
import { lineChart, animateNumber, initRipples, toast, loadPlans, savePlan, deletePlan, readLocaleNumber } from './ui.js';
import { mountNumi } from './numi.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const icon = k => `<svg viewBox="0 0 24 24"><path d="${ICONS[k]}"/></svg>`;
const store = {
  get: k => { try { return localStorage.getItem('numora.' + k); } catch (_) { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem('numora.' + k) : localStorage.setItem('numora.' + k, v); } catch (_) {} },
};

const S = { country: 'us', lang: 'en', source: 'default', calc: 'mortgage', values: {}, debt: null };
let t = makeT('en'), f = fmt('us', 'en'), cfgs = configs('us', 'en'), numi = null;

/* ---------------- boot ---------------- */
async function boot() {
  initRipples();
  applyTheme(store.get('theme'));
  const manual = store.get('country');
  if (manual && COUNTRIES[manual]) {
    S.country = manual; S.source = 'manual';
  } else {
    const d = await detectFromNetwork();
    S.country = d.country; S.source = d.source;
  }
  const lang = store.get('lang');
  S.lang = lang && LANGS.includes(lang) ? lang : pickLanguage(S.country);
  setLocale();
  readHash();
  numi = mountNumi(() => ({ country: S.country, lang: S.lang }), href => { location.hash = href.slice(1); });
  buildRail();
  render(true);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => document.body.classList.toggle('hero-off', !e.isIntersecting), { rootMargin: '-60px 0px 0px 0px' }).observe(document.querySelector('.hero'));
  $('boot').classList.add('done');
  setTimeout(() => $('boot').remove(), 600);
  const q = new URLSearchParams(location.search);
  if (q.get('ask')) numi.ask(q.get('ask'));
  if (q.get('saved')) openSaved();
  if (S.source === 'network' && !store.get('seen-geo')) { toast(`${flagOf(S.country)} ${countryName(S.country, S.lang)} · ${t('detected')}`); store.set('seen-geo', '1'); }
}

function setLocale() {
  t = makeT(S.lang);
  f = fmt(S.country, S.lang);
  cfgs = configs(S.country, S.lang);
  document.documentElement.lang = S.lang;
  document.documentElement.dir = RTL.has(S.lang) ? 'rtl' : 'ltr';
  $('tagline').textContent = t('tagline');
  $('loc-flag').textContent = flagOf(S.country);
  $('loc-txt').textContent = `${S.country.toUpperCase()} · ${S.lang.toUpperCase()}`;
  $('loc').setAttribute('aria-label', `${t('settings')}: ${countryName(S.country, S.lang)}`);
  $('saved-btn').setAttribute('aria-label', t('saved'));
  $('theme-btn').setAttribute('aria-label', t('theme'));
  $('more-lbl') && ($('more-lbl').textContent = t('more'));
  $('btn-save').lastChild.textContent = t('save');
  $('btn-share').lastChild.textContent = t('share');
  $('btn-ask').lastChild.textContent = t('askThis');
  $('disc').textContent = t('disclaimer');
  if (!S.debt) S.debt = debtDefaults(S.country);
}

/* ---------------- routing ---------------- */
const ALL = ORDER.flatMap(([, ids]) => ids);
function readHash() {
  const [id, qs] = location.hash.slice(1).split('?');
  S.calc = ALL.includes(id) ? id : S.calc;
  const p = new URLSearchParams(qs || '');
  if (S.calc === 'debt') {
    try { if (p.get('d')) S.debt = { debts: JSON.parse(p.get('d')), budget: Number(p.get('b')) || S.debt?.budget }; } catch (_) {}
  } else {
    const defs = Object.fromEntries(cfgs[S.calc].fields.map(x => [x.id, x.def]));
    const fromUrl = {};
    for (const [k, v] of p) if (k in defs && Number.isFinite(Number(v))) fromUrl[k] = Number(v);
    S.values[S.calc] = { ...defs, ...(S.values[S.calc] || {}), ...fromUrl };
  }
}
function writeHash() {
  const p = new URLSearchParams();
  if (S.calc === 'debt') { p.set('b', S.debt.budget); p.set('d', JSON.stringify(S.debt.debts)); }
  else for (const [k, v] of Object.entries(S.values[S.calc] || {})) p.set(k, String(Math.round(v * 100) / 100));
  history.replaceState(null, '', `#${S.calc}?${p}`);
}
addEventListener('hashchange', () => { const prev = S.calc; readHash(); markRail(); render(prev !== S.calc); });

/* ---------------- rail ---------------- */
function buildRail() {
  $('rail').innerHTML = ORDER.map(([cat, ids]) => `<div class="grp"><small>${esc(t('cat.' + cat))}</small>${ids.map(id =>
    `<a href="#${id}" class="pill tap" data-id="${id}">${icon(id)}<span>${esc(calcName(id, S.country, S.lang))}</span></a>`).join('')}</div>`).join('');
  $('rail').querySelectorAll('.pill').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    if (a.dataset.id === S.calc) return;
    location.hash = a.dataset.id;
  }));
  markRail();
}
function markRail() {
  $('rail').querySelectorAll('.pill').forEach(a => {
    const on = a.dataset.id === S.calc;
    a.classList.toggle('on', on);
    if (on) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } else a.removeAttribute('aria-current');
  });
}

/* ---------------- form ---------------- */
const fmtInput = (kind, v) => kind === 'money' ? new Intl.NumberFormat(f.locale, { maximumFractionDigits: 0 }).format(v) : new Intl.NumberFormat(f.locale, { maximumFractionDigits: 2, useGrouping: false }).format(v);
function field(fl, v) {
  const unit = fl.kind === 'pct' ? '%' : fl.kind === 'years' ? new Intl.NumberFormat(f.locale, { style: 'unit', unit: 'year', unitDisplay: 'narrow' }).formatToParts(2).filter(p => p.type === 'unit').map(p => p.value).join('').trim() : '';
  const stepv = fl.kind === 'money' ? Math.max(1, nice(fl.max / 200)) : fl.kind === 'pct' ? 0.1 : 1;
  const pct = Math.min(100, (v / fl.max) * 100);
  return `<div class="fld" data-k="${fl.kind}">
    <div class="fld-top"><label for="i-${fl.id}">${esc(fl.label)}</label>
      <div class="val">${fl.kind === 'money' ? `<span class="u">${esc(f.symbol)}</span>` : ''}<input id="i-${fl.id}" data-id="${fl.id}" inputmode="decimal" autocomplete="off" value="${esc(fmtInput(fl.kind, v))}">${unit ? `<span class="u">${esc(unit)}</span>` : ''}</div></div>
    <input type="range" class="rng" data-for="${fl.id}" min="0" max="${fl.max}" step="${stepv}" value="${Math.min(v, fl.max)}" style="--p:${pct}%" aria-label="${esc(fl.label)}">
  </div>`;
}
function buildForm() {
  $('title').textContent = calcName(S.calc, S.country, S.lang);
  $('p-ic').innerHTML = icon(S.calc);
  document.title = `${calcName(S.calc, S.country, S.lang)} · Numora`;
  if (S.calc === 'debt') return buildDebtForm();
  const v = S.values[S.calc];
  const fields = cfgs[S.calc].fields;
  const basic = fields.filter(x => !x.advanced), adv = fields.filter(x => x.advanced);
  $('form').innerHTML = basic.map(x => field(x, v[x.id])).join('') +
    (adv.length ? `<details class="adv"><summary class="tap"><span id="more-lbl">${esc(t('more'))}</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></summary>${adv.map(x => field(x, v[x.id])).join('')}</details>` : '');
}
function buildDebtForm() {
  const d = S.debt;
  const row = (x, i) => `<div class="drow" data-i="${i}">
    <input class="dn" value="${esc(x.name)}" aria-label="${esc(t('d.name'))}">
    <input class="db" inputmode="decimal" value="${esc(fmtInput('money', x.balance))}" aria-label="${esc(t('d.bal'))}">
    <input class="da" inputmode="decimal" value="${esc(fmtInput('pct', x.apr))}" aria-label="${esc(t('d.apr'))}">
    <input class="dm" inputmode="decimal" value="${esc(fmtInput('money', x.min))}" aria-label="${esc(t('d.min'))}">
    <button type="button" class="ib tap del" aria-label="✕"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
  const maxB = Math.max(nice(d.debts.reduce((s, x) => s + x.min, 0) * 4), d.budget);
  $('form').innerHTML = `<div class="dhead"><span>${esc(t('d.name'))}</span><span>${esc(t('d.bal'))}</span><span>${esc(t('d.apr'))}</span><span>${esc(t('d.min'))}</span><span></span></div>
    <div id="drows">${d.debts.map(row).join('')}</div>
    <button type="button" class="addd tap" id="add-debt">+ ${esc(t('d.add'))}</button>
    ${field({ id: 'budget', label: t('d.budget'), kind: 'money', max: maxB }, d.budget)}`;
  $('add-debt').addEventListener('click', () => {
    S.debt.debts.push({ name: `#${S.debt.debts.length + 1}`, balance: nice(1000 * COUNTRIES[S.country].scale), apr: COUNTRIES[S.country].rates.card, min: nice(50 * COUNTRIES[S.country].scale) });
    buildDebtForm(); compute();
  });
  $('form').querySelectorAll('.del').forEach(b => b.addEventListener('click', () => {
    S.debt.debts.splice(Number(b.closest('.drow').dataset.i), 1); buildDebtForm(); compute();
  }));
}
function readForm() {
  const num = el => readLocaleNumber(el.value, f.locale, parseAmount);
  if (S.calc === 'debt') {
    S.debt.debts = [...$('form').querySelectorAll('.drow')].map((r, i) => ({
      name: r.querySelector('.dn').value.trim() || `#${i + 1}`,
      balance: num(r.querySelector('.db')), apr: num(r.querySelector('.da')), min: num(r.querySelector('.dm')),
    })).filter(x => x.balance > 0 && x.apr >= 0 && x.min > 0);
    const b = num($('i-budget'));
    if (Number.isFinite(b)) S.debt.budget = b;
    return;
  }
  const v = S.values[S.calc];
  for (const fl of cfgs[S.calc].fields) {
    const x = num($('i-' + fl.id));
    if (Number.isFinite(x) && x >= 0) v[fl.id] = fl.kind === 'years' ? Math.max(x, 0.1) : x;
  }
}

/* ---------------- result ---------------- */
function render(swap) {
  if (swap) {
    $('stage').classList.remove('swap'); void $('stage').offsetWidth; $('stage').classList.add('swap');
    $('h-value').dataset.v = '0';
  }
  buildForm();
  compute();
}
function compute() {
  readForm();
  let view;
  if (S.calc === 'debt') view = S.debt.debts.length ? debtView(S.debt.debts, S.debt.budget, f, t) : { headline: { label: t('h.debt'), value: '—' }, stats: [], answer: '', insights: [], chart: null };
  else { const v = S.values[S.calc]; const c = cfgs[S.calc]; view = c.view(c.run(v), v, f); }
  $('h-label').textContent = view.headline.label;
  if (Number.isFinite(view.headline.num)) animateNumber($('h-value'), view.headline.num, f.money);
  else { $('h-value').textContent = view.headline.value; $('h-value').dataset.v = '0'; }
  $('h-sub').textContent = view.sub || '';
  $('stats').innerHTML = view.stats.map(s => `<div class="st"><small>${esc(s.label)}</small><b class="${s.good ? 'good' : ''}">${esc(s.value)}</b></div>`).join('');
  $('answer').textContent = view.answer;
  $('insights').innerHTML = view.insights.map(i => `<div class="in ${i.tone}"><i></i><span>${esc(i.text)}</span></div>`).join('');
  if (view.chart) {
    const narrow = new Intl.NumberFormat(f.locale, { style: 'unit', unit: 'year', unitDisplay: 'narrow' });
    lineChart($('chart'), view.chart.series, { yLabel: f.compact, xLabel: u => (u ? narrow.format(u) : ''), yearly: !!view.chart.yearly });
    $('legend').innerHTML = view.chart.legend.map(([tone, label]) => `<span><i style="background:var(--${tone})"></i>${esc(label)}</span>`).join('');
  } else { $('chart').innerHTML = ''; $('legend').innerHTML = ''; }
  $('mbar-l').textContent = view.headline.label;
  $('mbar-v').textContent = view.headline.value;
  S.view = view;
  writeHash();
}

/* ---------------- events ---------------- */
let timer;
$('form').addEventListener('input', e => {
  const el = e.target;
  if (el.classList.contains('rng')) {
    const id = el.dataset.for;
    const fl = S.calc === 'debt' ? { kind: 'money' } : cfgs[S.calc].fields.find(x => x.id === id);
    $('i-' + id).value = fmtInput(fl.kind, Number(el.value));
    el.style.setProperty('--p', `${(el.value / el.max) * 100}%`);
  } else if (el.dataset.id) {
    const r = $('form').querySelector(`.rng[data-for="${el.dataset.id}"]`);
    const x = readLocaleNumber(el.value, f.locale, parseAmount);
    if (r && Number.isFinite(x)) { r.value = Math.min(x, r.max); r.style.setProperty('--p', `${Math.min(100, (x / r.max) * 100)}%`); }
  }
  clearTimeout(timer); timer = setTimeout(compute, 25);
});
$('form').addEventListener('focusout', e => {
  const el = e.target;
  if (!el.dataset.id) return;
  const fl = S.calc === 'debt' ? { kind: 'money' } : cfgs[S.calc].fields.find(x => x.id === el.dataset.id);
  const x = readLocaleNumber(el.value, f.locale, parseAmount);
  if (Number.isFinite(x)) el.value = fmtInput(fl.kind, x);
});
$('form').addEventListener('submit', e => e.preventDefault());

$('btn-share').addEventListener('click', async () => {
  const url = location.href;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: document.title, text: S.view?.answer, url }); return; } catch (_) {} }
  try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch (_) { toast(url); }
});
$('btn-save').addEventListener('click', () => {
  const ok = savePlan({ hash: location.hash, country: S.country, calc: S.calc, title: calcName(S.calc, S.country, S.lang), value: `${S.view.headline.label}: ${S.view.headline.value}`, answer: S.view.answer });
  toast(ok ? t('savedToast') : '—');
  const b = $('btn-save'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
});
$('btn-ask').addEventListener('click', () => {
  numi.setContext(S.calc === 'debt' ? { intent: 'debt' } : { intent: S.calc, values: { ...S.values[S.calc] } });
  numi.ask(S.calc === 'debt' ? t('q.what') : S.calc === 'mortgage' ? t('q.more', { a: f.money(COUNTRIES[S.country].step * 2) }) : t('q.lower'));
});
$('mbar').addEventListener('click', () => $('result').scrollIntoView({ behavior: 'smooth', block: 'start' }));

/* ---------------- theme ---------------- */
function applyTheme(th) {
  if (th) document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme;
}
$('theme-btn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
  const next = dark ? 'light' : 'dark';
  document.documentElement.classList.add('theming');
  applyTheme(next); store.set('theme', next);
  setTimeout(() => document.documentElement.classList.remove('theming'), 400);
  if (S.view) compute();
});

/* ---------------- settings popover ---------------- */
let deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function openSettings() {
  const pop = $('pop');
  const names = Object.keys(COUNTRIES).map(code => [code, countryName(code, S.lang)]).sort((a, b) => a[1].localeCompare(b[1], S.lang));
  const langs = [...COUNTRIES[S.country].langs, ...LANGS.filter(l => !COUNTRIES[S.country].langs.includes(l))];
  pop.innerHTML = `<div class="pop-in">
    <label>${esc(t('country'))}<select id="sel-c">${names.map(([c, n]) => `<option value="${c}" ${c === S.country ? 'selected' : ''}>${flagOf(c)} ${esc(n)}</option>`).join('')}</select></label>
    <label>${esc(t('language'))}<select id="sel-l">${langs.map(l => `<option value="${l}" ${l === S.lang ? 'selected' : ''}>${esc(languageName(l))}</option>`).join('')}</select></label>
    ${S.source === 'network' || S.source === 'timezone' ? `<p class="src"><i></i>${esc(t(S.source === 'network' ? 'detected' : 'detectedTz'))}</p>` : ''}
    ${deferredInstall ? `<button class="btn tap" id="inst">${esc(t('install'))}</button>` : ''}</div>`;
  pop.hidden = false;
  requestAnimationFrame(() => pop.classList.add('in'));
  $('sel-c').addEventListener('change', e => {
    S.country = e.target.value; S.source = 'manual'; store.set('country', S.country);
    S.lang = pickLanguage(S.country); store.set('lang', null);
    S.values = {}; S.debt = null; history.replaceState(null, '', '#' + S.calc); relocalize(); closePop();
  });
  $('sel-l').addEventListener('change', e => { S.lang = e.target.value; store.set('lang', S.lang); relocalize(); closePop(); });
  $('inst')?.addEventListener('click', async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; closePop(); });
}
function closePop() { const pop = $('pop'); pop.classList.remove('in'); setTimeout(() => (pop.hidden = true), 180); }
function relocalize() {
  setLocale();
  readHash();
  if (S.calc !== 'debt') { const defs = Object.fromEntries(cfgs[S.calc].fields.map(x => [x.id, x.def])); S.values[S.calc] = { ...defs, ...S.values[S.calc] }; }
  buildRail(); render(true); numi.relabel();
}
$('loc').addEventListener('click', e => { e.stopPropagation(); $('pop').hidden ? openSettings() : closePop(); });
document.addEventListener('click', e => { if (!$('pop').hidden && !e.target.closest('#pop') && !e.target.closest('#loc')) closePop(); });

/* ---------------- saved drawer ---------------- */
function openSaved() {
  const d = $('drawer');
  const plans = loadPlans();
  d.innerHTML = `<div class="dr-in"><header><b>${esc(t('saved'))}</b><button class="ib tap" id="dr-x" aria-label="✕"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
    ${plans.length ? plans.map(p => `<div class="plan"><a class="tap" href="${esc(p.hash)}" data-c="${esc(p.country)}"><span>${icon(p.calc)}</span><div><b>${esc(p.title)}</b><small>${esc(p.value)}</small></div></a><button class="ib tap" data-at="${p.at}" aria-label="✕"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join('')
      : `<p class="empty">${esc(t('noSaved'))}</p>`}</div>`;
  d.hidden = false;
  requestAnimationFrame(() => d.classList.add('in'));
  $('dr-x').addEventListener('click', closeSaved);
  d.querySelectorAll('.plan a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    if (a.dataset.c !== S.country) { S.country = a.dataset.c; S.lang = pickLanguage(S.country); S.values = {}; S.debt = null; setLocale(); buildRail(); }
    location.hash = a.getAttribute('href').slice(1); closeSaved();
  }));
  d.querySelectorAll('.plan button').forEach(b => b.addEventListener('click', () => { deletePlan(Number(b.dataset.at)); openSaved(); }));
}
function closeSaved() { const d = $('drawer'); d.classList.remove('in'); setTimeout(() => (d.hidden = true), 250); }
$('saved-btn').addEventListener('click', openSaved);
$('drawer').addEventListener('click', e => { if (e.target.id === 'drawer') closeSaved(); });

let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => S.view && compute(), 120); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
