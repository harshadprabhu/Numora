// Plain-language input parser: regex + keyword rules, no AI.
// Turns "300k mortgage at 6.5% with 25 years left, can pay 200 extra" into form values.

const MULT = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 };

/** Parse one number token like "18k", "2,50,000", "1.5 lakh", "£220,000". */
export function parseAmount(raw) {
  if (!raw) return NaN;
  const s = String(raw).toLowerCase().replace(/[£$€₹¥]|rs\.?|inr|usd|gbp|cad|aud/g, '').trim();
  const m = s.match(/^([\d.,]+)\s*(k|thousand|mn|m|million|lakhs?|lac|l|crores?|cr)?\b/);
  if (!m) return NaN;
  let num = m[1];
  // "1.234,56" (European) vs "1,234.56" / "2,50,000"
  if (/\d\.\d{3},\d{1,2}$/.test(num)) num = num.replace(/\./g, '').replace(',', '.');
  else num = num.replace(/,/g, '');
  const v = parseFloat(num);
  return m[2] ? v * MULT[m[2]] : v;
}

const AMOUNT = String.raw`(?:[£$€₹¥]|rs\.?\s?)?\d[\d.,]*\s*(?:k|thousand|mn|million|lakhs?|lac|crores?|cr|m|l)?\b`;

/** Find all amounts with their position. */
export function amounts(text) {
  const re = new RegExp(AMOUNT, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12).toLowerCase();
    if (/^\s*(%|percent|pc\b|years?|yrs?|months?|mos?\b)/.test(after)) continue;
    const v = parseAmount(m[0]);
    if (Number.isFinite(v)) out.push({ value: v, index: m.index, raw: m[0].trim() });
  }
  return out;
}

export function parseMortgage(text) {
  const t = text.toLowerCase();
  const found = {};
  const unsure = [];
  const rate = t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|pc\b)/);
  if (rate) found.ratePct = parseFloat(rate[1]);
  const yrs = t.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
  const mos = t.match(/(\d+)\s*(?:months?|mos?\b)/);
  if (yrs) found.yearsLeft = parseFloat(yrs[1]);
  else if (mos) found.yearsLeft = Math.round((parseInt(mos[1], 10) / 12) * 10) / 10;
  const list = amounts(t);
  const extraIdx = t.search(/extra|more|additional|over ?pay|top.?up|on top/);
  const lumpIdx = t.search(/lump|one.?off|bonus|one.?time/);
  const nearest = idx => list.reduce((best, a) => (best === null || Math.abs(a.index - idx) < Math.abs(best.index - idx) ? a : best), null);
  if (lumpIdx >= 0 && list.length) { const a = nearest(lumpIdx); found.lumpSum = a.value; a.used = true; }
  if (extraIdx >= 0) {
    const a = list.filter(x => !x.used).reduce((best, x) => (best === null || Math.abs(x.index - extraIdx) < Math.abs(best.index - extraIdx) ? x : best), null);
    if (a) { found.extra = a.value; a.used = true; }
  }
  const rest = list.filter(a => !a.used).sort((a, b) => b.value - a.value);
  if (rest.length) {
    found.balance = rest[0].value;
    if (rest.length > 1 && !('extra' in found)) unsure.push('I found more than one amount; I used the largest as the balance.');
  }
  if (!('ratePct' in found)) unsure.push('No interest rate found; kept the current one.');
  if (!('yearsLeft' in found)) unsure.push('No term found; kept the current one.');
  return { found, unsure };
}

export function parseDebts(text) {
  const t = text.toLowerCase();
  const found = {};
  const unsure = [];
  const rate = t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|pc\b)/);
  const countM = t.match(/(\d+|two|three|four|five)\s*(?:credit\s*)?(?:cards?|loans?|debts?)/);
  const words = { two: 2, three: 3, four: 4, five: 5 };
  const count = countM ? (words[countM[1]] || parseInt(countM[1], 10)) : 1;
  const list = amounts(t);
  const budgetIdx = t.search(/can pay|per month|a month|monthly|\/mo|budget|afford/);
  let budget = null;
  if (budgetIdx >= 0 && list.length) {
    budget = list.reduce((best, a) => (best === null || Math.abs(a.index - budgetIdx) < Math.abs(best.index - budgetIdx) ? a : best), null);
    found.budget = budget.value;
  }
  const owed = list.filter(a => a !== budget).sort((a, b) => b.value - a.value)[0];
  if (owed) {
    const n = Math.max(1, Math.min(count, 8));
    const each = owed.value / n;
    const apr = rate ? parseFloat(rate[1]) : 20;
    found.debts = Array.from({ length: n }, (_, i) => ({
      name: n > 1 ? `Debt ${i + 1}` : 'Debt',
      balance: Math.round(each),
      apr,
      min: Math.max(Math.round(each * 0.03), 1),
    }));
    if (n > 1) unsure.push(`Split the ${owed.raw} total equally across ${n} debts. Edit each one for exact balances.`);
    if (!rate) unsure.push('No interest rate found; assumed 20%.');
    unsure.push('Minimum payments estimated at 3% of each balance. Check your statements.');
  }
  if (!('budget' in found)) unsure.push('No monthly budget found; kept the current one.');
  return { found, unsure };
}
