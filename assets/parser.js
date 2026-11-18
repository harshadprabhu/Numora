// Multilingual number and phrase parsing. Regex + keyword rules only, no AI.

const MULT = {
  k: 1e3, thousand: 1e3, tsd: 1e3, tausend: 1e3, mille: 1e3, mil: 1e3, ribu: 1e3, rb: 1e3, 'हज़ार': 1e3, 'हजार': 1e3, 'ألف': 1e3, '千': 1e3, '천': 1e3,
  m: 1e6, mn: 1e6, million: 1e6, millions: 1e6, mio: 1e6, millionen: 1e6, 'millón': 1e6, millones: 1e6, milioni: 1e6, milione: 1e6, 'milhão': 1e6, 'milhões': 1e6, juta: 1e6, jt: 1e6, 'مليون': 1e6,
  l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, 'लाख': 1e5, cr: 1e7, crore: 1e7, crores: 1e7, 'करोड़': 1e7, 'करोड': 1e7,
  '万': 1e4, '萬': 1e4, '만': 1e4, '千万': 1e7, '億': 1e8, '亿': 1e8, '억': 1e8, miliar: 1e9, billion: 1e9, bn: 1e9,
};
const SUFFIX = Object.keys(MULT).sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

export const YEARS = 'years?|yrs?|años?|anos?|années?|ans|an|jahren?|jahre|anni|anno|年|साल|वर्ष|년|سنوات|سنة|عاما|عام|tahun|thn';
export const MONTHS = 'months?|mos?|meses|mes|mois|monaten?|monate|mesi|mese|ヶ月|か月|カ月|个月|個月|महीने|महीनों|महीना|개월|أشهر|شهور|شهر|bulan';
const PCT = '%|percent|per ?cent|pct|pc\\b|por ?ciento|pour ?cent|prozent|per ?cento|por ?cento|パーセント|퍼센트|प्रतिशत|بالمئة|في المئة|persen';
const CJK = /[぀-ヿ一-鿿가-힯]/;

/** Normalize digits (full-width, Arabic-Indic, Devanagari), lower-case, join space-grouped thousands. */
export function normalize(text) {
  let s = String(text || '').normalize('NFKC').toLowerCase();
  s = s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0))
       .replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x966)).replace(/٫/g, '.').replace(/٬/g, ',');
  s = s.replace(/(\d)[\s  '](?=\d{3}\b)/g, '$1');                     // 20 000 / 20'000 -> 20000
  s = s.replace(new RegExp(`(\\d),(\\d{1,2})(?=\\s*(${PCT}))`, 'g'), '$1.$2');     // 6,5 % -> 6.5 %
  s = s.replace(new RegExp(`(\\d),(\\d)(?=\\s*(${YEARS}))`, 'g'), '$1.$2');        // 2,5 Jahre -> 2.5
  s = s.replace(/[’']/g, "'");
  return ` ${s} `;
}

/** "18k", "2,50,000", "1.5 lakh", "20.000" (euro), "300万", "3억". */
export function parseAmount(raw, euro = false) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).toLowerCase().replace(/r\$|[£$€₹¥₩﷼]|rs\.?|inr|usd|eur|gbp|cad|aud|jpy|yen|円|元|원|rp\.?|aed|sar|zar|myr|sgd|chf|mxn|brl|idr|krw|cny/g, '').trim();
  const m = s.match(new RegExp(`^([\\d.,]+)\\s*(${SUFFIX})?(?![a-z])`));
  if (!m) return NaN;
  let num = m[1];
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(num) || (euro && /^\d+,\d{1,2}$/.test(num))) num = num.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{2,3})+(\.\d+)?$/.test(num)) num = num.replace(/,/g, '');
  else num = num.replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
  const v = parseFloat(num);
  return m[2] ? v * MULT[m[2]] : v;
}

/** All money-like amounts with positions (skips rates, years and months). */
export function amounts(text, euro = false) {
  const re = new RegExp(`\\d[\\d.,]*\\s*(?:${SUFFIX})?(?![a-z])`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    let raw = m[0].trim();
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 14);
    if (new RegExp(`^\\s*(${PCT}|${YEARS}|${MONTHS})(?![a-z])`).test(after)) continue;
    raw = raw.replace(/[.,]$/, '');
    const v = parseAmount(raw, euro);
    if (Number.isFinite(v)) out.push({ value: v, index: m.index, raw });
  }
  return out;
}

export function pctList(t) {
  return [...t.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${PCT})`, 'g'))].map(m => ({ v: parseFloat(m[1]), i: m.index }));
}
export function yearsIn(t) {
  const y = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${YEARS})(?![a-z])`));
  if (y) return parseFloat(y[1]);
  const m = t.match(new RegExp(`(\\d+)\\s*(?:${MONTHS})(?![a-z])`));
  return m ? parseInt(m[1], 10) / 12 : null;
}

export const EXTRA_W = 'extra|more|additional|over ?pay|top.?up|on top|adicional|más|de plus|supplémentaire|en plus|zusätzlich|mehr|in più|aggiuntiv|a mais|追加|繰上|多还|额外|अतिरिक्त|ज़्यादा|ज्यादा|추가|إضافي|tambahan';
export const LUMP_W = 'lump|one.?off|bonus|one.?time|pago único|versement unique|einmal|sondertilgung|una tantum|única|一括|一次性|एकमुश्त|일시|دفعة واحدة|sekaligus';
export const MONTH_W = 'month|monthly|per month|/mo|al mes|mensual|par mois|mensuel|im monat|pro monat|monatlich|al mese|mensil|por mês|ao mês|毎月|每月|月|महीने|हर महीने|매달|매월|월|شهري|شهريا|شهر|bulan';

const nearest = (list, idx) => list.reduce((b, a) => (b === null || Math.abs(a.index - idx) < Math.abs(b.index - idx) ? a : b), null);

export function parseMortgage(text, euro = false) {
  const t = normalize(text);
  const found = {}, unsure = [];
  const rate = pctList(t)[0];
  if (rate) found.ratePct = rate.v;
  const y = yearsIn(t);
  if (y) found.yearsLeft = y;
  const list = amounts(t, euro);
  const lumpIdx = t.search(new RegExp(LUMP_W));
  const extraIdx = t.search(new RegExp(EXTRA_W));
  if (lumpIdx >= 0 && list.length) { const a = nearest(list, lumpIdx); found.lumpSum = a.value; a.used = true; }
  if (extraIdx >= 0) { const a = nearest(list.filter(x => !x.used), extraIdx); if (a) { found.extra = a.value; a.used = true; } }
  const rest = list.filter(a => !a.used).sort((a, b) => b.value - a.value);
  if (rest.length) found.balance = rest[0].value;
  if (rest.length > 1 && !('extra' in found)) unsure.push('several-amounts');
  return { found, unsure };
}

export function parseDebts(text, euro = false) {
  const t = normalize(text);
  const found = {};
  const rate = pctList(t)[0];
  const countM = t.match(/(\d+|two|three|four|five|dos|tres|deux|trois|zwei|drei|due|tre|duas|três)\s*(?:credit\s*)?(cards?|loans?|debts?|tarjetas|préstamos|deudas|cartes|prêts|dettes|karten|kredite|schulden|carte|prestiti|debiti|cartões|empréstimos|dívidas|枚|张|張|कार्ड|장|بطاقات|kartu)/);
  const words = { two: 2, three: 3, four: 4, five: 5, dos: 2, tres: 3, deux: 2, trois: 3, zwei: 2, drei: 3, due: 2, tre: 3, duas: 2, 'três': 3 };
  const count = countM ? (words[countM[1]] || parseInt(countM[1], 10)) : 1;
  const list = amounts(t, euro).filter(a => !(countM && a.index === countM.index));
  const bIdx = t.search(new RegExp(`can pay|budget|afford|${MONTH_W}`));
  let budget = null;
  if (bIdx >= 0 && list.length > 1) { budget = nearest(list, bIdx); found.budget = budget.value; }
  const owed = list.filter(a => a !== budget).sort((a, b) => b.value - a.value)[0];
  if (owed) {
    const n = Math.max(1, Math.min(count, 8));
    const each = owed.value / n;
    const apr = rate ? rate.v : 20;
    found.debts = Array.from({ length: n }, (_, i) => ({ name: `#${i + 1}`, balance: Math.round(each), apr, min: Math.max(Math.round(each * 0.03), 1) }));
  }
  return { found };
}

export const isCJK = s => CJK.test(s);
