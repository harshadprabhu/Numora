// Numi corner widget: floating orb + chat panel, voice in, read-aloud. No network.
import { respond, starterChips } from './numi-brain.js';
import { makeT } from './i18n.js';
import { localeOf } from './countries.js';

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function mountNumi(getState, onNavigate) {
  let ctx = {};
  let open = false;
  let speak = false;
  try { speak = localStorage.getItem('numora.speak') === '1'; } catch (_) {}

  const root = document.createElement('div');
  root.className = 'numi';
  root.innerHTML = `
    <div class="numi-hint" aria-hidden="true"></div>
    <button class="numi-fab tap" aria-expanded="false" aria-controls="numi-panel"><span class="orb"><i></i></span><span class="sr-only fab-label"></span></button>
    <section class="numi-panel" id="numi-panel" role="dialog" aria-modal="false" hidden>
      <header>
        <span class="orb sm"><i></i></span>
        <div><b>Numi</b><small class="sub"></small></div>
        <button class="ib tap speak" aria-pressed="${speak}"><svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg></button>
        <button class="ib tap close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </header>
      <div class="log" role="log" aria-live="polite"></div>
      <form class="composer">
        <textarea rows="1" aria-label="Message"></textarea>
        ${SR ? '<button type="button" class="ib tap mic" aria-label="Voice"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>' : ''}
        <button class="send tap" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
      </form>
    </section>`;
  document.body.appendChild(root);

  const fab = root.querySelector('.numi-fab');
  const panel = root.querySelector('.numi-panel');
  const log = root.querySelector('.log');
  const form = root.querySelector('form');
  const box = root.querySelector('textarea');
  const hint = root.querySelector('.numi-hint');

  function labels() {
    const { lang } = getState();
    const t = makeT(lang);
    root.querySelector('.sub').textContent = t('n.sub');
    root.querySelector('.fab-label').textContent = t('ask');
    fab.setAttribute('aria-label', t('ask'));
    box.placeholder = t('n.ph');
    hint.textContent = t('ask');
    root.querySelector('.speak').setAttribute('aria-label', t('n.listen'));
  }

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function addUser(text) { log.insertAdjacentHTML('beforeend', `<div class="m me"><p>${esc(text)}</p></div>`); scroll(); }
  function addBot(r) {
    const { country } = getState();
    const stats = (r.stats || []).slice(0, 3).map(s => `<div><small>${esc(s.label)}</small><b>${esc(s.value)}</b></div>`).join('');
    const chips = (r.chips || []).map(c => `<button type="button" class="chip tap">${esc(c)}</button>`).join('');
    log.insertAdjacentHTML('beforeend', `<div class="m bot" lang="${r.lang}" dir="${r.lang === 'ar' ? 'rtl' : 'auto'}">
      ${r.title ? `<em>${esc(r.title)}</em>` : ''}<p>${esc(r.text)}</p>
      ${stats ? `<div class="mstats">${stats}</div>` : ''}
      ${(r.tips || []).map(x => `<p class="tip">${esc(x)}</p>`).join('')}
      ${r.link ? `<a class="go tap" href="${esc(r.link.href)}">${esc(r.link.label)} →</a>` : ''}
      ${chips ? `<div class="chips">${chips}</div>` : ''}</div>`);
    const last = log.lastElementChild;
    last.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
    const go = last.querySelector('.go');
    if (go) go.addEventListener('click', e => { e.preventDefault(); onNavigate(go.getAttribute('href')); if (matchMedia('(max-width: 900px)').matches) toggle(false); });
    scroll();
    if (speak && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(r.text);
      u.lang = localeOf(country, r.lang);
      speechSynthesis.speak(u);
    }
  }

  function ask(text) {
    if (!String(text).trim()) return;
    if (!open) toggle(true);
    addUser(text);
    const typing = document.createElement('div');
    typing.className = 'm bot typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(typing); scroll();
    setTimeout(() => {
      typing.remove();
      const { country, lang } = getState();
      const r = respond(text, ctx, country, lang);
      ctx = r.ctx || ctx;
      addBot(r);
    }, 320);
  }

  function greet() {
    const { country, lang } = getState();
    log.innerHTML = '';
    addBot({ lang, text: makeT(lang)('n.hi'), chips: starterChips(country, lang) });
  }

  function toggle(force) {
    open = force ?? !open;
    fab.setAttribute('aria-expanded', String(open));
    root.classList.toggle('open', open);
    if (open) {
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('in'));
      if (!log.children.length) greet();
      setTimeout(() => box.focus(), 250);
    } else {
      panel.classList.remove('in');
      setTimeout(() => { if (!open) panel.hidden = true; }, 220);
    }
  }

  fab.addEventListener('click', () => toggle());
  root.querySelector('.close').addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) toggle(false); });
  form.addEventListener('submit', e => { e.preventDefault(); const q = box.value; box.value = ''; box.style.height = ''; ask(q); });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = Math.min(box.scrollHeight, 110) + 'px'; });
  const sp = root.querySelector('.speak');
  sp.addEventListener('click', () => {
    speak = !speak; sp.setAttribute('aria-pressed', String(speak));
    try { localStorage.setItem('numora.speak', speak ? '1' : '0'); } catch (_) {}
    if (!speak && 'speechSynthesis' in window) speechSynthesis.cancel();
  });
  const mic = root.querySelector('.mic');
  if (mic) {
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      const { country, lang } = getState();
      rec = new SR();
      rec.lang = localeOf(country, lang);
      rec.interimResults = true;
      mic.classList.add('live');
      box.placeholder = makeT(lang)('n.listen');
      rec.onresult = e => { box.value = [...e.results].map(x => x[0].transcript).join(' '); };
      rec.onend = () => { mic.classList.remove('live'); rec = null; labels(); if (box.value.trim()) form.requestSubmit(); };
      rec.onerror = () => { mic.classList.remove('live'); rec = null; labels(); };
      rec.start();
    });
  }

  labels();
  setTimeout(() => { if (!open) { root.classList.add('hinting'); setTimeout(() => root.classList.remove('hinting'), 3200); } }, 1500);

  return {
    ask,
    open: () => toggle(true),
    setContext(c) { ctx = c || {}; },
    relabel() { labels(); if (log.children.length <= 1) greet(); },
  };
}
