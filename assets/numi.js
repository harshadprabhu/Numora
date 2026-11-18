// Numi chat UI: messages, suggestion chips, voice input and read-aloud. No network.
import { respond, starterChips } from './numi-brain.js';
import { COUNTRIES, detectCountry } from './locale.js';

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function mountChat(host, { compact = false } = {}) {
  let ctx = {};
  let speakOn = false;
  try { speakOn = localStorage.getItem('numora.speak') === '1'; } catch (_) {}
  const country = () => (document.getElementById('country')?.value) || detectCountry();

  host.innerHTML = `
    <div class="chat ${compact ? 'compact' : ''}">
      <div class="chat-head">
        <div class="numi-avatar" aria-hidden="true"><span></span></div>
        <div><div class="chat-title">Numi</div><div class="chat-sub">Your money assistant · private, runs on your device</div></div>
        <button class="icon-btn speak-toggle" aria-pressed="${speakOn}" title="Read answers aloud" aria-label="Read answers aloud">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>
        </button>
      </div>
      <div class="chat-log" role="log" aria-live="polite"></div>
      <form class="chat-input" autocomplete="off">
        <label class="sr-only" for="numi-in-${compact ? 's' : 'p'}">Ask Numi</label>
        <textarea id="numi-in-${compact ? 's' : 'p'}" rows="1" placeholder="Ask a money question…"></textarea>
        ${SR ? `<button type="button" class="icon-btn mic" aria-label="Speak your question"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}
        <button class="send" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
      </form>
    </div>`;

  const log = host.querySelector('.chat-log');
  const form = host.querySelector('form');
  const box = host.querySelector('textarea');
  const speakBtn = host.querySelector('.speak-toggle');

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const addUser = text => { log.insertAdjacentHTML('beforeend', `<div class="msg me"><div class="bubble">${esc(text)}</div></div>`); scroll(); };

  function addBot(r) {
    const stats = (r.stats || []).slice(0, 4).map(s => `<div class="mstat"><div>${esc(s.label)}</div><b>${esc(s.value)}</b></div>`).join('');
    const tips = (r.tips || []).map(t => `<div class="mtip">💡 ${esc(t)}</div>`).join('');
    const chips = (r.chips || []).map(ch => `<button type="button" class="chip-btn">${esc(ch)}</button>`).join('');
    const html = `<div class="msg bot"><div class="numi-avatar sm" aria-hidden="true"><span></span></div><div class="bubble card-bubble">
      ${r.title ? `<div class="mtitle">${esc(r.title)}</div>` : ''}
      <div class="mtext">${esc(r.text)}</div>
      ${stats ? `<div class="mstats">${stats}</div>` : ''}${tips}
      ${r.link ? `<a class="btn mlink" href="${esc(r.link.href)}">${esc(r.link.label)} →</a>` : ''}
      ${chips ? `<div class="mchips">${chips}</div>` : ''}
    </div></div>`;
    log.insertAdjacentHTML('beforeend', html);
    log.lastElementChild.querySelectorAll('.chip-btn').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
    scroll();
    if (speakOn && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(r.text.replace(/\(I assumed.*\)/, ''));
      u.lang = COUNTRIES[country()].locale;
      speechSynthesis.speak(u);
    }
  }

  function ask(text) {
    if (!text.trim()) return;
    addUser(text);
    const typing = document.createElement('div');
    typing.className = 'msg bot typing';
    typing.innerHTML = '<div class="numi-avatar sm"><span></span></div><div class="bubble"><i></i><i></i><i></i></div>';
    log.appendChild(typing); scroll();
    setTimeout(() => {
      typing.remove();
      const r = respond(text, ctx, country());
      ctx = r.ctx || ctx;
      addBot(r);
      if (r.navigate) setTimeout(() => (location.href = r.navigate), 600);
    }, 350);
  }

  addBot({ text: `Hi, I'm Numi 👋 Ask me any money question in plain words, like you'd ask a friend who's good with numbers. You can type or ${SR ? 'tap the mic and ' : ''}speak.`, chips: starterChips(COUNTRIES[country()]) });

  form.addEventListener('submit', e => { e.preventDefault(); const q = box.value; box.value = ''; box.style.height = ''; ask(q); });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = Math.min(box.scrollHeight, 120) + 'px'; });
  speakBtn.addEventListener('click', () => {
    speakOn = !speakOn; speakBtn.setAttribute('aria-pressed', String(speakOn));
    try { localStorage.setItem('numora.speak', speakOn ? '1' : '0'); } catch (_) {}
    if (!speakOn && 'speechSynthesis' in window) speechSynthesis.cancel();
  });

  const mic = host.querySelector('.mic');
  if (mic && SR) {
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = COUNTRIES[country()].locale;
      rec.interimResults = true;
      mic.classList.add('live');
      rec.onresult = e => { box.value = [...e.results].map(x => x[0].transcript).join(' '); };
      rec.onend = () => { mic.classList.remove('live'); rec = null; if (box.value.trim()) form.requestSubmit(); };
      rec.onerror = () => { mic.classList.remove('live'); rec = null; };
      rec.start();
    });
  }

  return {
    ask,
    setContext(c) { ctx = c || {}; },
  };
}
