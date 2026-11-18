import { parseAmount } from './parser.js';
// Shared UI helpers: chart, toast, saved plans, share links, number animation.

export function lineChart(el, series, { labelX = m => m, money = v => v } = {}) {
  const W = 640, H = 240, P = { l: 56, r: 12, t: 12, b: 28 };
  const maxX = Math.max(...series.map(s => s.data.length - 1), 1);
  const maxY = Math.max(...series.flatMap(s => s.data), 1);
  const X = i => P.l + (i / maxX) * (W - P.l - P.r);
  const Y = v => P.t + (1 - v / maxY) * (H - P.t - P.b);
  const ticks = 4;
  let grid = '';
  for (let k = 0; k <= ticks; k++) {
    const v = (maxY / ticks) * k, y = Y(v);
    grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="var(--line)"/>`;
    grid += `<text x="${P.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${money(v)}</text>`;
  }
  const yearsTotal = Math.ceil(maxX / 12);
  const stepYears = Math.max(1, Math.ceil(yearsTotal / 6));
  for (let yr = 0; yr <= yearsTotal; yr += stepYears) {
    const x = X(Math.min(yr * 12, maxX));
    grid += `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${labelX(yr)}</text>`;
  }
  const paths = series.map(s => {
    const step = Math.max(1, Math.floor(s.data.length / 240));
    const pts = s.data.filter((_, i) => i % step === 0 || i === s.data.length - 1)
      .map((v, i, arr) => `${X(i === arr.length - 1 ? s.data.length - 1 : i * step).toFixed(1)},${Y(v).toFixed(1)}`);
    const area = s.fill ? `<path d="M${P.l},${Y(0)} L${pts.join(' L')} L${X(s.data.length - 1)},${Y(0)} Z" fill="${s.color}" opacity=".10"/>` : '';
    return `${area}<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="6 5"' : ''}/>`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Balance over time">${grid}${paths}</svg>`;
}

export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

export function animateNumber(el, to, format) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const from = parseFloat(el.dataset.v || '0');
  el.dataset.v = String(to);
  if (reduce || !Number.isFinite(to) || !Number.isFinite(from)) { el.textContent = format(to); return; }
  const start = performance.now(), dur = 380;
  const tick = now => {
    const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = format(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const PLANS = 'numora.plans';
export function loadPlans(kind) {
  try { return (JSON.parse(localStorage.getItem(PLANS) || '[]')).filter(p => p.kind === kind); } catch (_) { return []; }
}
export function savePlan(kind, name, params) {
  try {
    const all = JSON.parse(localStorage.getItem(PLANS) || '[]');
    all.unshift({ kind, name, params, at: Date.now() });
    localStorage.setItem(PLANS, JSON.stringify(all.slice(0, 30)));
    return true;
  } catch (_) { return false; }
}
export function deletePlan(kind, at) {
  try {
    const all = JSON.parse(localStorage.getItem(PLANS) || '[]').filter(p => !(p.kind === kind && p.at === at));
    localStorage.setItem(PLANS, JSON.stringify(all));
  } catch (_) {}
}

export function shareUrl(params) {
  const u = new URL(location.href);
  u.search = new URLSearchParams(params).toString();
  return u.toString();
}

export async function copyLink(params) {
  const url = shareUrl(params);
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url); toast('Link copied: it reopens this exact result'); }
  catch (_) { toast('Link is in the address bar: copy it from there'); }
}

/** Accept "350k", "3,50,000", "45 lakh", "1.234,56" etc. in number fields. */
export function readNumber(input) {
  return parseAmount(String(input.value).trim());
}

/** Show grouped digits when a field loses focus (e.g. 4500000 -> 45,00,000 in India). */
export function formatOnBlur(input, locale) {
  input.addEventListener('blur', () => {
    const v = readNumber(input);
    const loc = typeof locale === 'function' ? locale() : locale;
    if (Number.isFinite(v)) input.value = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(v);
  });
}
