// App shell: top bar, bottom tab bar (mobile), Numi chat sheet, PWA registration.
import { mountCountrySwitcher, mountThemeToggle } from './locale.js';

const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
  saved: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
};
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

export function mountShell(active, onCountry) {
  const top = document.createElement('header');
  top.className = 'site-header';
  top.innerHTML = `
    <div class="wrap">
      <a class="brand" href="./"><span class="brand-mark" aria-hidden="true"></span>Numora</a>
      <span class="badge">Preview</span>
      <span class="spacer"></span>
      <nav class="nav" aria-label="Main">
        <a href="./" ${active === 'home' ? 'aria-current="page"' : ''}>Home</a>
        <a href="./#all" ${active === 'calcs' ? 'aria-current="page"' : ''}>Calculators</a>
        <a href="saved.html" ${active === 'saved' ? 'aria-current="page"' : ''}>Saved</a>
      </nav>
      <button class="ask-btn" id="ask-open" type="button">${svg(I.chat)}<span>Ask Numi</span></button>
      <label class="sr-only" for="country">Country</label>
      <select id="country" class="control"></select>
      <button id="theme" class="icon-btn" aria-label="Switch light or dark theme">${svg(I.moon)}</button>
    </div>`;
  document.body.prepend(top);

  const tabs = document.createElement('nav');
  tabs.className = 'tabbar';
  tabs.setAttribute('aria-label', 'App');
  const tab = (id, href, icon, label) => `<a href="${href}" class="${active === id ? 'on' : ''}" ${active === id ? 'aria-current="page"' : ''}>${svg(icon)}<span>${label}</span></a>`;
  tabs.innerHTML = tab('home', './', I.home, 'Home') + tab('calcs', './#all', I.grid, 'Calculators') + tab('ask', 'ask.html', I.chat, 'Ask Numi') + tab('saved', 'saved.html', I.saved, 'Saved');
  document.body.appendChild(tabs);

  mountThemeToggle();
  const country = mountCountrySwitcher(onCountry);

  // Numi sheet (lazy-loaded).
  const openBtn = document.getElementById('ask-open');
  if (active === 'ask') openBtn.style.display = 'none';
  openBtn.addEventListener('click', () => openNumi());

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  return country;
}

let sheet = null;
export async function openNumi(question, context) {
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.className = 'sheet-backdrop';
    sheet.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Ask Numi">
      <div class="sheet-grip" aria-hidden="true"></div>
      <button class="icon-btn sheet-close" aria-label="Close">✕</button>
      <div id="numi-sheet" class="chat-host"></div></div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', e => { if (e.target === sheet) closeNumi(); });
    sheet.querySelector('.sheet-close').addEventListener('click', closeNumi);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNumi(); });
    const { mountChat } = await import('./numi.js');
    sheet._chat = mountChat(document.getElementById('numi-sheet'), { compact: true });
  }
  sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (context) sheet._chat.setContext(context);
  if (question) sheet._chat.ask(question);
  else setTimeout(() => sheet.querySelector('textarea, input')?.focus(), 200);
}
function closeNumi() {
  if (!sheet) return;
  sheet.classList.remove('open');
  document.body.style.overflow = '';
}
