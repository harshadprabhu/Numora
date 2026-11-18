// Country profiles + automatic detection from the visitor's network.
// Rates are illustrative example defaults for the calculators, not live market data.

// code: [currency, languages, scale, mortgage balance, mortgage rate, years, {loan, savings, invest, inflation, card, fd}, fdPerYear, flags]
const RAW = {
  us: ['USD', ['en'], 1, 350000, 6.5, 25, [8.5, 4, 7, 3, 22, 4.2], 12, {}],
  ca: ['CAD', ['en', 'fr'], 1.3, 480000, 4.8, 25, [8, 3, 6.5, 2.5, 21, 3.5], 1, { semiannual: true }],
  mx: ['MXN', ['es'], 15, 2500000, 11, 20, [18, 9, 10, 4.5, 45, 10], 12, {}],
  br: ['BRL', ['pt'], 4, 400000, 11.5, 30, [22, 10, 11, 4.5, 120, 11], 12, {}],
  gb: ['GBP', ['en'], 0.8, 220000, 4.5, 25, [7.5, 4, 6, 3, 23, 4.2], 1, {}],
  ie: ['EUR', ['en'], 0.9, 280000, 4, 30, [8, 2.5, 6, 2.5, 20, 2.5], 1, {}],
  de: ['EUR', ['de'], 0.9, 300000, 3.6, 25, [6.5, 2.5, 6, 2.5, 15, 2.5], 1, {}],
  fr: ['EUR', ['fr'], 0.9, 220000, 3.4, 20, [5.5, 2.5, 6, 2, 18, 2.5], 1, {}],
  it: ['EUR', ['it'], 0.8, 160000, 3.5, 25, [8, 2.5, 6, 2, 16, 2.5], 1, {}],
  es: ['EUR', ['es'], 0.7, 160000, 3, 25, [7.5, 2.5, 6, 2.5, 20, 2.5], 1, {}],
  pt: ['EUR', ['pt'], 0.6, 150000, 3.4, 30, [8, 2.5, 6, 2.5, 16, 2.5], 1, {}],
  ch: ['CHF', ['de', 'fr', 'it'], 1, 600000, 2, 25, [6, 1, 5, 1, 12, 1], 1, {}],
  at: ['EUR', ['de'], 0.9, 250000, 3.6, 25, [6.5, 2.5, 6, 2.5, 15, 2.5], 1, {}],
  be: ['EUR', ['fr'], 0.9, 220000, 3.4, 20, [6, 2.5, 6, 2.5, 15, 2.5], 1, {}],
  in: ['INR', ['en', 'hi'], 20, 4500000, 8.5, 20, [10.5, 6.5, 12, 5, 40, 7], 4, { homeLoan: true, emi: true, sip: true }],
  cn: ['CNY', ['zh'], 5, 1500000, 3.5, 25, [5, 1.5, 6, 1.5, 18, 1.8], 1, {}],
  jp: ['JPY', ['ja'], 120, 30000000, 1.5, 30, [4, 0.3, 5, 2, 15, 0.4], 1, {}],
  kr: ['KRW', ['ko'], 1200, 300000000, 4.2, 30, [6, 3, 6, 2.5, 16, 3], 12, {}],
  sg: ['SGD', ['en', 'zh'], 1.3, 800000, 3.2, 25, [6, 2.5, 6, 2.5, 26, 2.8], 12, { homeLoan: true }],
  au: ['AUD', ['en'], 1.5, 600000, 6, 25, [9, 4.5, 7, 3, 20, 4.5], 1, { homeLoan: true }],
  nz: ['NZD', ['en'], 1.6, 550000, 5.8, 25, [10, 4, 6.5, 3, 20, 4.5], 1, { homeLoan: true }],
  ae: ['AED', ['ar', 'en'], 3.5, 1200000, 5, 25, [7, 4, 7, 2.5, 36, 4.5], 12, { homeLoan: true }],
  sa: ['SAR', ['ar', 'en'], 3.5, 800000, 5.5, 25, [7, 4.5, 7, 2, 30, 5], 12, { homeLoan: true }],
  za: ['ZAR', ['en'], 15, 1200000, 11, 20, [15, 7.5, 10, 4.5, 21, 8], 12, { homeLoan: true }],
  id: ['IDR', ['id'], 12000, 600000000, 8, 15, [12, 3, 9, 3, 21, 4.5], 12, {}],
  my: ['MYR', ['en'], 4, 450000, 4.2, 30, [7, 3, 6, 2.5, 18, 3], 12, { homeLoan: true }],
};

export const LANGS = ['en', 'hi', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ar', 'id'];

export const flagOf = code => String.fromCodePoint(...code.toUpperCase().split('').map(ch => 127397 + ch.charCodeAt(0)));

function nice(v) { if (v <= 0) return 0; const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; }

export const COUNTRIES = Object.fromEntries(Object.entries(RAW).map(([code, r]) => {
  const [currency, langs, scale, bal, rate, years, [loan, savings, invest, inflation, card, fd], fdPerYear, flags] = r;
  return [code, {
    code, currency, langs, scale, flag: flagOf(code), fdPerYear,
    compounding: flags.semiannual ? 'semiannual' : 'monthly',
    homeLoan: !!flags.homeLoan, emiName: !!flags.emi, sipName: !!flags.sip,
    mortgage: { balance: bal, ratePct: rate, yearsLeft: years },
    rates: { loan, savings, invest, inflation, card, fd },
    step: nice(100 * scale),
  }];
}));

/** Full locale tag for formatting, e.g. hi-IN, fr-CA, ar-AE. */
export const localeOf = (country, lang) => `${lang}-${country.toUpperCase()}`;

export function countryName(code, lang) {
  try { return new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(code.toUpperCase()); } catch (_) { return code.toUpperCase(); }
}
export function languageName(lang) {
  try { return new Intl.DisplayNames([lang], { type: 'language' }).of(lang); } catch (_) { return lang; }
}

// Where an unsupported country is detected, fall back to the closest supported market.
const FALLBACK = { ar: 'mx', co: 'mx', cl: 'mx', pe: 'mx', ec: 'mx', gt: 'mx', ve: 'mx', uy: 'br', py: 'br', bo: 'mx',
  nl: 'de', lu: 'be', dk: 'de', se: 'de', no: 'de', fi: 'de', pl: 'de', cz: 'at', gr: 'it', mc: 'fr',
  hk: 'sg', tw: 'cn', mo: 'cn', th: 'my', vn: 'sg', ph: 'sg', pk: 'in', bd: 'in', lk: 'in', np: 'in',
  qa: 'ae', kw: 'ae', bh: 'ae', om: 'ae', eg: 'sa', jo: 'sa', ma: 'fr', ng: 'za', ke: 'za', gh: 'za', us: 'us' };

const TZ = { 'Asia/Kolkata': 'in', 'Asia/Calcutta': 'in', 'Europe/London': 'gb', 'Europe/Dublin': 'ie', 'Europe/Berlin': 'de', 'Europe/Paris': 'fr',
  'Europe/Rome': 'it', 'Europe/Madrid': 'es', 'Europe/Lisbon': 'pt', 'Europe/Zurich': 'ch', 'Europe/Vienna': 'at', 'Europe/Brussels': 'be',
  'Asia/Shanghai': 'cn', 'Asia/Tokyo': 'jp', 'Asia/Seoul': 'kr', 'Asia/Singapore': 'sg', 'Asia/Dubai': 'ae', 'Asia/Riyadh': 'sa',
  'Africa/Johannesburg': 'za', 'Asia/Jakarta': 'id', 'Asia/Kuala_Lumpur': 'my', 'America/Mexico_City': 'mx', 'America/Sao_Paulo': 'br',
  'America/Toronto': 'ca', 'America/Vancouver': 'ca', 'Pacific/Auckland': 'nz' };

const resolve = code => {
  const c = String(code || '').toLowerCase();
  return COUNTRIES[c] ? c : FALLBACK[c] || null;
};

async function fetchJSON(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); return r.ok ? await r.json() : null; }
  catch (_) { return null; } finally { clearTimeout(t); }
}

/**
 * Country from the visitor's network (IP). Only the 2-letter country code is requested.
 * Falls back to the device timezone, then the US.
 * Returns { country, source: 'network' | 'timezone' | 'default', raw }.
 */
export async function detectFromNetwork() {
  for (const url of ['https://api.country.is/', 'https://get.geojs.io/v1/ip/country.json']) {
    const j = await fetchJSON(url, 2500);
    const c = resolve(j && j.country);
    if (c) return { country: c, source: 'network', raw: (j.country || '').toLowerCase() };
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ[tz]) return { country: TZ[tz], source: 'timezone', raw: TZ[tz] };
    if (tz && tz.startsWith('America/')) return { country: 'us', source: 'timezone', raw: 'us' };
    if (tz && tz.startsWith('Australia/')) return { country: 'au', source: 'timezone', raw: 'au' };
  } catch (_) { /* ignore */ }
  return { country: 'us', source: 'default', raw: 'us' };
}

/** Best UI language for a country: the device language if the country uses it, else the country's main language. */
export function pickLanguage(country) {
  const c = COUNTRIES[country];
  const device = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  for (const d of device) {
    const l = String(d).slice(0, 2).toLowerCase();
    if (c.langs.includes(l)) return l;
  }
  return c.langs[0];
}
