// Country profiles for the preview. Values are illustrative defaults, not live rates.
export const COUNTRIES = {
  us: { code: 'us', mortgageTitle: 'Mortgage payoff calculator', nlExample: '300k mortgage at 6.5% with 25 years left, can pay 200 extra', balanceHint: 'e.g. 350k',
        name: 'United States', flag: '🇺🇸', locale: 'en-US', currency: 'USD',
        compounding: 'monthly', step: 100,
        mortgage: { balance: 350000, ratePct: 6.5, yearsLeft: 25 },
        debt: { budget: 900, debts: [
          { name: 'Visa', balance: 6500, apr: 24.9, min: 160 },
          { name: 'Store card', balance: 1800, apr: 29.9, min: 55 },
          { name: 'Car loan', balance: 9800, apr: 7.9, min: 290 } ] },
        city: 'Austin', mortgageTerm: 'mortgage' },
  gb: { code: 'gb', mortgageTitle: 'Mortgage overpayment calculator', nlExample: '220k mortgage at 4.5%, 25 years left, can overpay 150 a month', balanceHint: 'e.g. 220k',
        name: 'United Kingdom', flag: '🇬🇧', locale: 'en-GB', currency: 'GBP',
        compounding: 'monthly', step: 100,
        mortgage: { balance: 220000, ratePct: 4.5, yearsLeft: 25 },
        debt: { budget: 650, debts: [
          { name: 'Credit card', balance: 4200, apr: 22.9, min: 105 },
          { name: 'Overdraft', balance: 1200, apr: 39.9, min: 40 },
          { name: 'Personal loan', balance: 7000, apr: 8.9, min: 210 } ] },
        city: 'Manchester', mortgageTerm: 'mortgage' },
  ca: { code: 'ca', mortgageTitle: 'Mortgage prepayment calculator', nlExample: '480k mortgage at 4.8%, 25 years left, 200 extra a month', balanceHint: 'e.g. 480k',
        name: 'Canada', flag: '🇨🇦', locale: 'en-CA', currency: 'CAD',
        compounding: 'semiannual', step: 100,
        mortgage: { balance: 480000, ratePct: 4.8, yearsLeft: 25 },
        debt: { budget: 950, debts: [
          { name: 'Visa', balance: 5800, apr: 20.99, min: 170 },
          { name: 'Line of credit', balance: 9000, apr: 9.95, min: 230 },
          { name: 'Store card', balance: 1500, apr: 29.99, min: 50 } ] },
        city: 'Toronto', mortgageTerm: 'mortgage' },
  au: { code: 'au', mortgageTitle: 'Home loan extra repayments calculator', nlExample: '600k home loan at 6%, 25 years left, 300 extra a month', balanceHint: 'e.g. 600k',
        name: 'Australia', flag: '🇦🇺', locale: 'en-AU', currency: 'AUD',
        compounding: 'monthly', step: 100,
        mortgage: { balance: 600000, ratePct: 6.0, yearsLeft: 25 },
        debt: { budget: 1000, debts: [
          { name: 'Credit card', balance: 7000, apr: 20.99, min: 210 },
          { name: 'Personal loan', balance: 12000, apr: 11.5, min: 350 },
          { name: 'Buy-now-pay-later', balance: 900, apr: 0, min: 75 } ] },
        city: 'Melbourne', mortgageTerm: 'home loan' },
  in: { code: 'in', mortgageTitle: 'Home loan prepayment calculator', nlExample: '45 lakh home loan at 8.5%, 20 years left, can pay 10k extra', balanceHint: 'e.g. 45 lakh',
        name: 'India', flag: '🇮🇳', locale: 'en-IN', currency: 'INR',
        compounding: 'monthly', step: 5000,
        mortgage: { balance: 4500000, ratePct: 8.5, yearsLeft: 20 },
        debt: { budget: 45000, debts: [
          { name: 'Credit card', balance: 180000, apr: 42, min: 9000 },
          { name: 'Personal loan', balance: 450000, apr: 13.5, min: 15000 },
          { name: 'Consumer EMI', balance: 60000, apr: 16, min: 6000 } ] },
        city: 'Pune', mortgageTerm: 'home loan' },
};

const KEY = 'numora.country';

export function detectCountry() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && COUNTRIES[saved]) return saved;
  } catch (_) { /* storage blocked */ }
  const lang = (navigator.language || 'en-US').toLowerCase();
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  if (lang.endsWith('-in') || lang.startsWith('hi') || tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'in';
  if (lang.endsWith('-gb') || tz === 'Europe/London') return 'gb';
  if (lang.endsWith('-ca') || tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver')) return 'ca';
  if (lang.endsWith('-au') || tz.startsWith('Australia/')) return 'au';
  return 'us';
}

export function saveCountry(code) {
  try { localStorage.setItem(KEY, code); } catch (_) { /* ignore */ }
}

export function fmt(country) {
  const c = COUNTRIES[country];
  const money = new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat(c.locale, { maximumFractionDigits: 2 });
  return {
    money: v => (Number.isFinite(v) ? money.format(Math.round(v)) : '—'),
    num: v => num.format(v),
    duration: months => {
      if (!Number.isFinite(months)) return 'never';
      const y = Math.floor(months / 12), m = months % 12;
      const parts = [];
      if (y) parts.push(`${y} yr${y === 1 ? '' : 's'}`);
      if (m) parts.push(`${m} mo`);
      return parts.join(' ') || '0 mo';
    },
    date: monthsFromNow => {
      if (!Number.isFinite(monthsFromNow)) return 'never';
      const d = new Date();
      d.setMonth(d.getMonth() + monthsFromNow);
      return new Intl.DateTimeFormat(c.locale, { month: 'short', year: 'numeric' }).format(d);
    },
    symbol: (0).toLocaleString(c.locale, { style: 'currency', currency: c.currency, maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, ''),
  };
}

/** Header country switcher shared by every page. */
export function mountCountrySwitcher(onChange) {
  const sel = document.getElementById('country');
  if (!sel) return detectCountry();
  sel.innerHTML = Object.values(COUNTRIES)
    .map(c => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('');
  const current = detectCountry();
  sel.value = current;
  sel.addEventListener('change', () => { saveCountry(sel.value); onChange && onChange(sel.value); });
  return current;
}

/** Light/dark theme toggle (follows the system until the user picks). */
export function mountThemeToggle() {
  const btn = document.getElementById('theme');
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('numora.theme'); } catch (_) {}
  if (saved) root.dataset.theme = saved;
  if (!btn) return;
  btn.addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('numora.theme', root.dataset.theme); } catch (_) {}
  });
}
