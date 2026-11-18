import { mountShell, openNumi } from './shell.js';
import { COUNTRIES, fmt } from './locale.js';
import { catalog, CATEGORIES, icon, configs } from './calcs.js';
import { starterChips } from './numi-brain.js';
import { loadAllPlans } from './ui.js';
import { mortgagePayoff } from './engine.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function greet() {
  const h = new Date().getHours();
  $('greet').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function render(code) {
  const c = COUNTRIES[code];
  const f = fmt(code);
  const items = catalog(c);
  const cfg = configs(c);
  $('cname').textContent = c.name;
  $('ask-q').placeholder = `Ask Numi… e.g. ${starterChips(c)[0]}`;
  $('quick').innerHTML = starterChips(c).map(q => `<button type="button">${esc(q)}</button>`).join('');
  $('quick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => openNumi(b.textContent)));

  // Popular rail: live "teaser" numbers from the calculators' defaults.
  const m = mortgagePayoff({ ...c.mortgage, extra: c.step * 2, compounding: c.compounding });
  const teaser = id => {
    const k = cfg[id]; if (!k) return '';
    const v = Object.fromEntries(k.fields.map(x => [x.id, x.def]));
    return k.view(k.run(v), v, f).headline.value;
  };
  const pop = [
    { id: 'mortgage', big: f.money(m.interestSaved), small: `saved by paying ${f.money(c.step * 2)} extra a month`, cls: '' },
    { id: 'sip', big: teaser('sip'), small: `from ${f.money(cfg.sip.fields[0].def)} a month for ${cfg.sip.fields[2].def} years`, cls: 'alt' },
    { id: 'fire', big: teaser('fire'), small: 'when could you stop working?', cls: 'warm' },
    { id: 'card', big: teaser('card'), small: 'until a typical card balance is gone', cls: 'alt' },
  ];
  $('popular').innerHTML = pop.map(p => {
    const it = items.find(x => x.id === p.id);
    return `<a class="feature" href="${it.href}"><div style="display:flex;gap:12px;align-items:center"><span class="tile-ic ${p.cls}">${icon(it.icon)}</span><b>${esc(it.name)}</b></div>
      <div><div class="big">${esc(p.big)}</div><small>${esc(p.small)}</small></div></a>`;
  }).join('');

  $('cats').innerHTML = CATEGORIES.map(cat => `
    <div class="rail-head"><h2>${cat.name}</h2></div>
    <div class="cat-grid">${items.filter(i => i.cat === cat.id).map(i => `
      <a class="cat-item" href="${i.href}"><span class="tile-ic ${cat.id === 'grow' ? 'alt' : cat.id === 'plan' ? 'warm' : ''}">${icon(i.icon)}</span>
      <div><b>${esc(i.name)}</b><span>${esc(i.blurb)}</span></div></a>`).join('')}</div>`).join('');

  const plans = loadAllPlans().slice(0, 3);
  $('saved-wrap').hidden = !plans.length;
  $('saved').innerHTML = plans.map(p => `<div class="saved-item"><a href="${esc(p.href)}"><b>${esc(p.name)}</b><small>${esc(p.title || '')}</small></a></div>`).join('');
}

greet();
const code = mountShell('home', render);
render(code);

$('ask-form').addEventListener('submit', e => { e.preventDefault(); const q = $('ask-q').value.trim(); if (q) { openNumi(q); $('ask-q').value = ''; } else openNumi(); });

// PWA install prompt.
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('install').classList.add('show'); $('install-hint').hidden = true; });
$('install').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('install').classList.remove('show'); });
