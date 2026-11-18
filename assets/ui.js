// UI helpers: chart, number animation, ripple, toast, saved plans, locale-aware number input.

const TONE = { accent: 'var(--accent)', alt: 'var(--alt)', muted: 'var(--muted)' };
let gid = 0;

/** Smooth area/line chart in SVG, with a draw-in animation. */
export function lineChart(el, series, { yLabel = v => v, xLabel = i => i, yearly = false } = {}) {
  const box = el.getBoundingClientRect();
  const W = Math.max(280, Math.round(box.width || 640)), H = Math.max(120, Math.round(box.height || 220)), P = { l: 54, r: 10, t: 10, b: 24 };
  const n = Math.max(...series.map(s => s.data.length)) - 1 || 1;
  const maxY = Math.max(...series.flatMap(s => s.data).filter(Number.isFinite), 1) * 1.05;
  const X = i => P.l + (i / n) * (W - P.l - P.r);
  const Y = v => P.t + (1 - v / maxY) * (H - P.t - P.b);
  let grid = '';
  for (let k = 0; k <= 3; k++) {
    const v = (maxY / 3) * k, y = Y(v);
    grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="gl"/><text x="${P.l - 8}" y="${y + 4}" text-anchor="end" class="gt">${yLabel(v)}</text>`;
  }
  const unit = yearly ? 1 : 12;
  const total = Math.ceil(n / unit);
  const stepX = Math.max(1, Math.ceil(total / 6));
  for (let u = 0; u <= total; u += stepX) grid += `<text x="${X(Math.min(u * unit, n))}" y="${H - 6}" text-anchor="middle" class="gt">${xLabel(u)}</text>`;
  const id = ++gid;
  const paths = series.map((s, si) => {
    const stride = Math.max(1, Math.floor(s.data.length / 160));
    const pts = [];
    s.data.forEach((v, i) => { if (i % stride === 0 || i === s.data.length - 1) pts.push([X(i), Y(Math.max(0, v))]); });
    const d = smooth(pts);
    const col = TONE[s.tone] || s.tone;
    const area = s.fill ? `<path d="${d} L${pts[pts.length - 1][0]},${Y(0)} L${pts[0][0]},${Y(0)} Z" fill="url(#g${id}-${si})" class="area"/>` : '';
    return `<defs><linearGradient id="g${id}-${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      ${area}<path d="${d}" fill="none" stroke="${col}" stroke-width="${s.dash ? 1.6 : 2.4}" ${s.dash ? 'stroke-dasharray="5 5"' : 'class="draw" pathLength="1"'} stroke-linecap="round"/>`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-hidden="true">${grid}${paths}</svg>`;
}
function smooth(p) {
  if (p.length < 3) return `M${p.map(q => q.join(',')).join(' L')}`;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

export function animateNumber(el, to, format) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const from = parseFloat(el.dataset.v || '0');
  el.dataset.v = String(to);
  if (reduce || !Number.isFinite(to) || !Number.isFinite(from) || from === to) { el.textContent = format(to); return; }
  cancelAnimationFrame(el._raf);
  const start = performance.now(), dur = 520;
  const tick = now => {
    const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = format(from + (to - from) * e);
    if (k < 1) el._raf = requestAnimationFrame(tick);
  };
  el._raf = requestAnimationFrame(tick);
}

/** Material-style ripple + tiny haptic on anything with .tap */
export function initRipples() {
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.tap');
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const s = document.createElement('span');
    const size = Math.max(r.width, r.height) * 2;
    s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.appendChild(s);
    setTimeout(() => s.remove(), 600);
    if (navigator.vibrate && e.pointerType === 'touch') { try { navigator.vibrate(6); } catch (_) {} }
  }, { passive: true });
}

export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

const PLANS = 'numora.plans.v3';
export function loadPlans() { try { return JSON.parse(localStorage.getItem(PLANS) || '[]'); } catch (_) { return []; } }
export function savePlan(plan) {
  try { const all = loadPlans(); all.unshift({ ...plan, at: Date.now() }); localStorage.setItem(PLANS, JSON.stringify(all.slice(0, 40))); return true; } catch (_) { return false; }
}
export function deletePlan(at) { try { localStorage.setItem(PLANS, JSON.stringify(loadPlans().filter(p => p.at !== at))); } catch (_) {} }

/** Parse a number typed in the user's locale ("1.234,5" in de, "12,34,567" in en-IN), plus k/lakh/万 suffixes. */
export function readLocaleNumber(str, locale, parseAmount) {
  const s = String(str).trim();
  if (!s) return NaN;
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find(p => p.type === 'group')?.value || ',';
  const dec = parts.find(p => p.type === 'decimal')?.value || '.';
  const plain = s.replace(/[\s  ]/g, '').split(group).join('').replace(dec, '.').replace(/[^\d.\-]/g, '');
  const direct = parseFloat(plain);
  if (!/[a-z\u0900-\u097f\u3040-\u9fff\uac00-\ud7af\u0600-\u06ff]/i.test(s)) return direct;
  const v = parseAmount(s, dec === ',');
  return Number.isFinite(v) ? v : direct;
}
