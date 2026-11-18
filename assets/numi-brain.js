// Numi: rules-based, multilingual money assistant. No AI, no network.
import { COUNTRIES, LANGS, localeOf } from './countries.js';
import { makeT } from './i18n.js';
import { configs, fmt, calcName, debtView } from './calcs.js';
import { normalize, amounts, pctList, yearsIn, parseMortgage, parseDebts, EXTRA_W, MONTH_W } from './parser.js';

const commaDecimal = (country, lang) => { try { return new Intl.NumberFormat(localeOf(country, lang)).formatToParts(1.5).find(p => p.type === 'decimal')?.value === ','; } catch (_) { return false; } };

// Intent keywords across 12 languages. Order matters: first match wins.
const INTENTS = [
  ['rentbuy', /rent.*buy|buy.*rent|alquil.*compr|compr.*alquil|lou.*achet|achet.*lou|miet.*kauf|kauf.*miet|affitt.*compr|compr.*affitt|alug.*compr|compr.*alug|賃貸|租房.*买房|买房.*租房|किराय.*खरीद|खरीद.*किराय|월세.*매매|매매.*월세|전세|إيجار.*شراء|شراء.*إيجار|sewa.*beli|beli.*sewa/],
  ['debt', /snowball|avalanche|bola de nieve|avalancha|boule de neige|schneeball|lawine|valanga|palla di neve|bola de neve|雪だるま|雪球|雪崩法|स्नोबॉल|눈덩이|눈사태|كرة الثلج|bola salju|longsoran|\bdebts\b|\bdeudas\b|\bdettes\b|\bschulden\b|\bdebiti\b|dívidas|कर्ज़ों|कर्जों|ديون|several (loans|cards)|\d+\s*(cards|tarjetas|cartes|karten|carte|cartões|kartu)/],
  ['card', /credit ?card|\bcard\b|tarjeta|carte de crédit|carte bancaire|kreditkarte|carta di credito|cartão|クレジットカード|カード|信用卡|क्रेडिट कार्ड|신용카드|카드|بطاقة|kartu kredit/],
  ['fire', /retire|\bfire\b|financial(ly)? independen|jubila|retirarme|retraite|ruhestand|\brente\b|pensione|aposent|リタイア|退職|老後|退休|रिटायर|सेवानिवृत्त|은퇴|التقاعد|أتقاعد|pensiun/],
  ['fd', /\bfd\b|fixed deposit|term deposit|\bcd\b|\bgic\b|plazo fijo|depósito a plazo|dépôt à terme|festgeld|conto deposito|deposito vincolato|depósito a prazo|\bcdb\b|定期預金|定期存款|定存|सावधि जमा|एफडी|정기예금|وديعة|deposito/],
  ['sip', /\bsip\b|mutual fund|monthly invest|sparplan|piano di accumulo|aporte mensal|積立|定投|定额|एसआईपी|म्यूचुअल फंड|적립|استثمار شهري|reksa dana|investasi bulanan|(invest|invertir|investir|investire|investieren|anlegen|investasi|投資|投资|निवेश|투자|استثمار).{0,30}(month|mes|mois|monat|mese|mês|月|महीने|월|شهر|bulan)|(month|mes|mois|monat|mese|mês|毎月|每月|महीने|매달|شهري|bulan).{0,30}(invest|invertir|investir|investire|投資|投资|निवेश|투자|استثمار|investasi)/],
  ['goal', /save for|savings goal|how much (should|do|to|must)( i)? save|need to save|ahorrar para|cuánto ahorrar|épargner pour|combien épargner|sparen für|wie viel.*sparen|risparmiare per|quanto risparmiare|poupar para|quanto poupar|guardar para|貯め|存钱|攒钱|बचत करनी|बचाना|저축|모으려|ادخار|أدخر|menabung/],
  ['inflation', /inflation|inflación|inflação|inflazione|インフレ|通胀|通货膨胀|महंगाई|मुद्रास्फीति|인플레이션|물가|التضخم|inflasi|teuerung/],
  ['mortgage', /mortgage|home ?loan|housing loan|overpay|prepay|hipoteca|hypothèque|prêt immobilier|crédit immobilier|hypothek|baufinanzierung|immobilienkredit|mutuo|financiamento imobiliário|住宅ローン|房贷|房屋贷款|होम लोन|गृह ऋण|주택담보대출|주담대|تمويل عقاري|رهن عقاري|\bkpr\b/],
  ['compound', /compound|lump ?sum|interés compuesto|intérêts composés|zinseszins|interesse composto|juros compostos|複利|复利|चक्रवृद्धि|복리|الفائدة المركبة|bunga majemuk/],
  ['emi', /\bemi\b|\bloan\b|borrow|repayment|préstamo|\bprêt\b|\bcrédit\b|kredit|darlehen|prestito|finanziamento|empréstimo|ローン|借入|贷款|貸款|लोन|ऋण|ईएमआई|대출|قرض|pinjaman|cicilan/],
];

const ASKS = /what('s| is| are| does)|explain|meaning|define|tell me about|qué es|que es|qué significa|explica|qu'est-ce|c'est quoi|expliqu|was ist|was bedeutet|erklär|cos'è|cosa è|che cos|spiega|o que é|o que são|o que significa|explique|とは|って何|是什么|什么是|解释|क्या है|क्या होता|मतलब|समझा|란|이란|무엇|뭐야|ما هو|ما هي|ما معنى|اشرح|apa itu|apa arti|jelaskan/;
const GLOSSARY = [
  ['compound', /compound|compuesto|composés|zinseszins|composto|compostos|複利|复利|चक्रवृद्धि|복리|المركبة|majemuk/],
  ['inflation', /inflation|inflación|inflação|inflazione|インフレ|通胀|通货膨胀|महंगाई|मुद्रास्फीति|인플레이션|التضخم|inflasi/],
  ['emergency', /emergency|emergencia|d'urgence|précaution|notgroschen|notfall|emergenza|reserva de emergência|生活防衛|紧急|应急|आपातकालीन|इमरजेंसी|비상금|الطوارئ|darurat/],
  ['fire', /\bfire\b|independencia financiera|indépendance financière|finanzielle unabhängigkeit|indipendenza finanziaria|independência financeira|経済的自立|财务自由|वित्तीय स्वतंत्रता|경제적 자유|الاستقلال المالي|kebebasan finansial/],
  ['r72', /72/],
  ['sip', /\bsip\b|एसआईपी|積立|定投|적립식|sparplan|\bpac\b|aporte/],
  ['emi', /\bemi\b|ईएमआई|月供|cuota|mensualité|monatsrate|\brata\b|parcela|cicilan|월 상환/],
  ['apr', /\bapr\b|\btae\b|taeg|effektiver|\bcet\b|実質年率|年化利率|연이율|الفائدة السنوية|bunga efektif/],
];

const LOWER = /lower|less|down|reduc|más baj|menor|baisse|plus bas|moins|niedriger|weniger|sinkt|più bass|meno|inferior|mais baix|低|下が|낮|कम|أقل|انخفض|lebih rendah|turun/;
const HIGHER = /higher|up\b|increase|más alt|mayor|sube|hausse|plus élevé|augment|höher|steigt|più alt|aument|maior|mais alt|高|上が|높|ज़्यादा|अधिक|أعلى|ارتفع|lebih tinggi|naik/;

/** Detect the language of the question; falls back to the UI language. */
export function detectLang(text, ui) {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[가-힯]/.test(text)) return 'ko';
  if (/[぀-ヿ]/.test(text)) return 'ja';
  if (/[一-鿿]/.test(text)) return ui === 'ja' ? 'ja' : 'zh';
  if (/[؀-ۿ]/.test(text)) return 'ar';
  const s = ` ${text.toLowerCase()} `;
  const score = {
    es: /\b(qué|cuánto|cuándo|años|préstamo|hipoteca|al mes|ahorr|invert|jubil|pago|tipo|interés|y si|tengo)/g,
    fr: /\b(qu'est|quand|combien|ans\b|prêt|par mois|taux|retraite|je\b|intérêts|épargn|et si|puis)/g,
    de: /\b(was\b|wann|wie\b|jahre|monat|kredit|zins|rente|ich\b|und wenn|baufinanz|sparen|für\b|über\b)/g,
    it: /\b(cos'|quando|quanto|anni\b|al mese|mutuo|prestito|pensione|tasso|interesse|e se\b|ho\b)/g,
    pt: /\b(o que|quando|quanto|anos\b|por mês|juros|aposent|financiamento|empréstimo|eu\b|me\b|você|poupar)/g,
    id: /\b(apa\b|kapan|berapa|tahun|per bulan|bunga|pensiun|saya|bagaimana|kpr\b|pinjaman|jika)/g,
    en: /\b(what|when|how|loan|years?\b|month|rate|if\b|my\b|i\b|the\b|pay|invest|retire)/g,
  };
  let best = null, max = 0;
  for (const [l, re] of Object.entries(score)) { const n = (s.match(re) || []).length; if (n > max) { max = n; best = l; } }
  if (!best) return LANGS.includes(ui) ? ui : 'en';
  if (best === 'en' && ui !== 'en' && max < 2) return ui;
  return best;
}

const ageIn = t => {
  const m = t.match(/(?:\bage\b|\baged\b|i am|i'm|\bim\b|tengo|j'ai|ich bin|\bho\b|tenho|عمري|umur(?: saya)?)\s*(\d{2})/) ||
            t.match(/(\d{2})\s*(?:years?\s*old|歳|岁|साल का|साल की|살|jahre alt|ans\b|años\b|anni\b|anos\b|tahun\b)/);
  return m ? parseInt(m[1], 10) : null;
};
function near(list, t, re, exclude = []) {
  const hits = [...t.matchAll(new RegExp(re, 'g'))].map(m => m.index);
  let best = null, bestD = 1e9;
  for (const a of list) {
    if (exclude.includes(a)) continue;
    for (const h of hits) { const d = Math.abs(a.index - h); if (d < bestD && d < 40) { best = a; bestD = d; } }
  }
  return best;
}
const largest = (list, exclude = []) => list.filter(a => !exclude.includes(a)).sort((a, b) => b.value - a.value)[0] || null;

function extract(intent, t, euro) {
  const age = ageIn(t);
  const list = amounts(t, euro).filter(a => !(age && a.value === age));
  const pcts = pctList(t);
  const yrs = intent === 'fire' ? null : yearsIn(t);
  const p0 = pcts[0]?.v;
  const v = {};
  const set = (k, x) => { if (x !== null && x !== undefined && Number.isFinite(x)) v[k] = x; };
  switch (intent) {
    case 'mortgage': Object.assign(v, parseMortgage(t, euro).found); break;
    case 'emi': set('principal', largest(list)?.value); set('ratePct', p0); set('years', yrs); break;
    case 'card': { const pay = near(list, t, `pay|payment|paying|${MONTH_W}`); const bal = largest(list, pay ? [pay] : []); set('balance', bal?.value); if (pay && pay !== bal) set('payment', pay.value); set('aprPct', p0); break; }
    case 'rentbuy': { const rent = near(list, t, 'rent|alquiler|loyer|miete|affitto|aluguel|家賃|租金|किराया|월세|إيجار|sewa'); const price = largest(list, rent ? [rent] : []); set('price', price?.value); if (rent && rent !== price) set('rent', rent.value); set('horizon', yrs); break; }
    case 'fire': {
      set('age', age);
      const spend = near(list, t, 'spend|expens|live on|need|gast|dépens|ausgab|spes|gasto|支出|开销|खर्च|지출|أنفق|belanja');
      const saved = near(list, t, 'saved|have|savings|invested|ahorrad|épargn|gespart|risparmi|guardad|貯蓄|存款|बचत|모은|مدخر|tabungan', spend ? [spend] : []);
      const monthly = near(list, t, `invest|save|put|${MONTH_W}`, [spend, saved].filter(Boolean));
      if (spend) { const perMonth = new RegExp(MONTH_W).test(t.slice(spend.index, spend.index + 30)); set('annualSpend', perMonth ? spend.value * 12 : spend.value); }
      set('savings', saved?.value); set('monthly', monthly?.value); set('ratePct', p0); break;
    }
    case 'fd': set('principal', largest(list)?.value); set('ratePct', p0); set('years', yrs); break;
    case 'sip': {
      set('monthly', (near(list, t, MONTH_W) || largest(list))?.value);
      const kw = t.search(/step|increase|raise|top.?up|aument|augment|erhöh|增|増|बढ़|증액|زيادة|naik/);
      const step = kw < 0 ? null : pcts.reduce((b, p) => (b === null || Math.abs(p.i - kw) < Math.abs(b.i - kw) ? p : b), null);
      const ret = pcts.find(p => p !== step);
      set('ratePct', ret?.v); if (step) set('stepUpPct', step.v); set('years', yrs); break;
    }
    case 'goal': { const cur = near(list, t, 'have|saved|already|tengo|j\'ai|habe|ho |tenho|已|저축한|لدي|punya'); const tgt = largest(list, cur ? [cur] : []); set('target', tgt?.value); if (cur && cur !== tgt) set('current', cur.value); set('ratePct', p0); set('years', yrs); break; }
    case 'inflation': set('amount', largest(list)?.value); set('inflationPct', p0); set('years', yrs); break;
    case 'compound': { const mo = near(list, t, MONTH_W); const p = largest(list, mo ? [mo] : []); set('principal', p?.value); if (mo && mo !== p) set('monthly', mo.value); set('ratePct', p0); set('years', yrs); break; }
  }
  return v;
}

function followUp(intent, prev, t, cfg, euro) {
  const v = { ...prev };
  const rateF = cfg.fields.find(f => f.kind === 'pct');
  const yearsF = cfg.fields.find(f => f.kind === 'years');
  const moneyF = cfg.fields.find(f => f.kind === 'money');
  let changed = false;
  const p = pctList(t)[0];
  const list = amounts(t, euro);
  if (p && rateF) {
    if (LOWER.test(t)) v[rateF.id] = Math.max(0, (v[rateF.id] || 0) - p.v);
    else if (HIGHER.test(t) && !list.length) v[rateF.id] = (v[rateF.id] || 0) + p.v;
    else v[rateF.id] = p.v;
    changed = true;
  }
  const y = yearsIn(t);
  if (y && yearsF) { v[yearsF.id] = y; changed = true; }
  if (list.length) {
    let target = moneyF?.id;
    if (intent === 'mortgage' && new RegExp(EXTRA_W + '|多く|더|lebih').test(t)) { v.extra = (v.extra || 0) + list[0].value; changed = true; target = null; }
    else if (intent === 'card') target = 'payment';
    else if (intent === 'fire') target = 'monthly';
    if (target) { v[target] = list[0].value; changed = true; }
  }
  return changed ? v : null;
}

function starter(country, lang) {
  const c = COUNTRIES[country], f = fmt(country, lang), t = makeT(lang);
  const M = x => f.money(Math.round(x));
  return [
    t('q.loan', { a: M(c.step * 100), r: f.num(c.rates.loan) }),
    t('q.home', { a: M(c.mortgage.balance), r: f.num(c.mortgage.ratePct), y: c.mortgage.yearsLeft, x: M(c.step * 2) }),
    t('q.sip', { a: M(c.step * 5) }),
    t('q.retire'),
    t('q.what'),
  ];
}
export { starter as starterChips };

function followChips(intent, country, lang) {
  const t = makeT(lang), f = fmt(country, lang), c = COUNTRIES[country];
  if (intent === 'mortgage') return [t('q.more', { a: f.money(c.step * 2) }), t('q.lower')];
  if (intent === 'debt') return [t('q.what')];
  return [t('q.lower'), t('q.longer')];
}

function link(intent, values, country) {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(values || {})) if (Number.isFinite(val)) p.set(k, String(Math.round(val * 100) / 100));
  return `#${intent}${p.toString() ? '?' + p : ''}`;
}

/**
 * respond(text, ctx, country, uiLang) -> { lang, title, text, stats, tips, link, chips, ctx }
 * ctx = { intent, values } from the previous answer, or set by the page ("ask about this").
 */
export function respond(input, ctx = {}, country = 'us', uiLang = 'en') {
  const raw = String(input || '').trim();
  const lang = raw ? detectLang(raw, uiLang) : uiLang;
  const t = makeT(lang);
  const f = fmt(country, lang);
  const euro = commaDecimal(country, lang);
  const n = normalize(raw);
  const words = raw.split(/\s+/).filter(Boolean).length;
  const base = { lang };

  if (!raw) return { ...base, text: t('n.hi'), chips: starter(country, lang), ctx };
  if (/^\s*(hi|hello|hey|hola|bonjour|salut|hallo|ciao|olá|oi|namaste|नमस्ते|こんにちは|你好|안녕|مرحبا|السلام|halo|hai)\b/.test(n) && words <= 4) return { ...base, text: t('n.hi'), chips: starter(country, lang), ctx: {} };
  if (/(thank|thanks|gracias|merci|danke|grazie|obrigad|धन्यवाद|शुक्रिया|ありがとう|谢谢|감사|고마워|شكرا|terima kasih)/.test(n) && words <= 5) return { ...base, text: t('n.thanks'), chips: starter(country, lang).slice(0, 3), ctx };
  if (/what can you do|^\s*help\s*$|ayuda|aide|hilfe|aiuto|ajuda|मदद|ヘルプ|帮助|도움|مساعدة|bantuan/.test(n) && words <= 6) return { ...base, text: t('n.help'), chips: starter(country, lang), ctx };

  // Glossary
  const hasDigits = /\d/.test(n.replace(/\b72\b/, ''));
  if (ASKS.test(n) && !hasDigits) {
    const g = GLOSSARY.find(([, re]) => re.test(n));
    if (g) return { ...base, title: t(`g.${g[0]}.t`), text: t(`g.${g[0]}`), chips: starter(country, lang).slice(0, 3), ctx };
  }

  const cfgs = configs(country, lang);
  let intent = (INTENTS.find(([, re]) => re.test(n)) || [])[0];
  let values = null;

  if (ctx.intent && ctx.intent !== 'debt' && cfgs[ctx.intent] && (!intent || intent === ctx.intent)) {
    const v = followUp(ctx.intent, ctx.values || {}, n, cfgs[ctx.intent], euro);
    if (v) { intent = ctx.intent; values = v; }
  }
  if (!intent) return { ...base, text: t('n.unknown'), chips: starter(country, lang), ctx };

  if (intent === 'debt') {
    const { found } = parseDebts(n, euro);
    if (!found.debts) return { ...base, title: calcName('debt', country, lang), text: t('b.debt'), link: { href: '#debt', label: t('n.open') }, ctx: { intent: 'debt' } };
    const budget = found.budget || Math.round(found.debts.reduce((s, d) => s + d.min, 0) * 1.5);
    const view = debtView(found.debts, budget, f, t);
    const p = new URLSearchParams({ b: String(budget), d: JSON.stringify(found.debts) });
    return { ...base, title: calcName('debt', country, lang), text: view.answer, stats: view.stats, tips: view.insights.slice(0, 1).map(i => i.text), link: { href: `#debt?${p}`, label: t('n.open') }, chips: followChips('debt', country, lang), ctx: { intent: 'debt' } };
  }

  const cfg = cfgs[intent];
  const defaults = Object.fromEntries(cfg.fields.map(x => [x.id, x.def]));
  const found = values ? {} : extract(intent, n, euro);
  const v = values || { ...defaults, ...found };
  const view = cfg.view(cfg.run(v), v, f);
  const key = cfg.fields.filter(x => !x.advanced && (intent !== 'mortgage' || x.id !== 'extra')).map(x => x.id);
  const assumed = values ? [] : key.filter(k => !(k in found)).slice(0, 3);
  const show = k => { const fl = cfg.fields.find(x => x.id === k); const val = v[k]; return `${fl.label.toLowerCase()} ${fl.kind === 'money' ? f.money(val) : fl.kind === 'pct' ? f.pct(val) : fl.kind === 'years' ? f.years(val) : f.num(val)}`; };
  return {
    ...base,
    title: calcName(intent, country, lang),
    text: view.answer + (assumed.length ? ` ${t('n.assumed', { list: assumed.map(show).join(', ') })}` : ''),
    stats: view.stats,
    tips: view.insights.slice(0, 1).map(i => i.text),
    link: { href: link(intent, v, country), label: t('n.open') },
    chips: followChips(intent, country, lang),
    ctx: { intent, values: v },
  };
}
