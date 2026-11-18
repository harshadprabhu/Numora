import { test } from 'node:test';
import assert from 'node:assert/strict';
import { respond, detectLang, starterChips } from '../assets/numi-brain.js';
import { parseAmount, normalize, amounts } from '../assets/parser.js';

const ask = (q, ctx = {}, c = 'us', l = 'en') => respond(q, ctx, c, l);

test('greeting and glossary', () => {
  assert.match(ask('hi').text, /Numi/);
  assert.equal(ask('what is APR?').title, 'APR');
  assert.equal(ask('¿Qué es el interés compuesto?', {}, 'es', 'es').title, 'Interés compuesto');
  assert.equal(ask('複利とは？', {}, 'jp', 'ja').title, '複利');
});

test('English EMI and relative follow-up', () => {
  const a = ask('loan of 20000 at 9% for 4 years');
  assert.equal(a.ctx.intent, 'emi');
  assert.equal(a.ctx.values.principal, 20000);
  const b = ask('what if the rate is 1% lower?', a.ctx);
  assert.equal(b.ctx.values.ratePct, 8);
  const c = ask('what about 3 years?', b.ctx);
  assert.equal(c.ctx.values.years, 3);
});

test('India: lakh EMI in English and Hindi', () => {
  const a = ask('EMI on 10 lakh at 10% for 5 years', {}, 'in', 'en');
  assert.equal(a.ctx.values.principal, 1000000);
  assert.match(a.text, /21,247/);
  const h = ask('10 लाख का लोन 10% पर 5 साल के लिए', {}, 'in', 'en');
  assert.equal(h.lang, 'hi');
  assert.equal(h.ctx.intent, 'emi');
  assert.equal(h.ctx.values.principal, 1000000);
  assert.match(h.text, /ईएमआई|प्रति माह|किस्त/);
});

test('Spanish loan, German with euro formatting, Japanese 万, Chinese, Korean, Arabic, Indonesian', () => {
  const es = ask('Préstamo de 20.000 € al 9% a 4 años', {}, 'es', 'es');
  assert.equal(es.lang, 'es'); assert.equal(es.ctx.intent, 'emi'); assert.equal(es.ctx.values.principal, 20000); assert.equal(es.ctx.values.years, 4);
  const de = ask('Kredit über 20.000 € zu 6,5 % für 5 Jahre', {}, 'de', 'de');
  assert.equal(de.lang, 'de'); assert.equal(de.ctx.values.principal, 20000); assert.equal(de.ctx.values.ratePct, 6.5);
  const ja = ask('300万円のローン、年利3%、5年', {}, 'jp', 'ja');
  assert.equal(ja.lang, 'ja'); assert.equal(ja.ctx.values.principal, 3000000); assert.equal(ja.ctx.values.years, 5);
  const zh = ask('贷款30万，利率4%，5年', {}, 'cn', 'zh');
  assert.equal(zh.lang, 'zh'); assert.equal(zh.ctx.values.principal, 300000);
  const ko = ask('3000만원 대출, 금리 5%, 3년', {}, 'kr', 'ko');
  assert.equal(ko.lang, 'ko'); assert.equal(ko.ctx.values.principal, 30000000);
  const ar = ask('قرض 50000 بفائدة 8% لمدة 5 سنوات', {}, 'ae', 'ar');
  assert.equal(ar.lang, 'ar'); assert.equal(ar.ctx.intent, 'emi'); assert.equal(ar.ctx.values.principal, 50000);
  const id = ask('Pinjaman 50 juta bunga 10% selama 3 tahun', {}, 'id', 'id');
  assert.equal(id.lang, 'id'); assert.equal(id.ctx.values.principal, 50000000);
});

test('French mortgage with extra, Portuguese retirement, Italian SIP', () => {
  const fr = ask('Prêt immobilier de 220 000 € à 3,4 % sur 20 ans, 200 € de plus par mois', {}, 'fr', 'fr');
  assert.equal(fr.lang, 'fr'); assert.equal(fr.ctx.intent, 'mortgage');
  assert.equal(fr.ctx.values.balance, 220000); assert.equal(fr.ctx.values.ratePct, 3.4); assert.equal(fr.ctx.values.extra, 200);
  const pt = ask('Quando posso me aposentar?', {}, 'br', 'pt');
  assert.equal(pt.lang, 'pt'); assert.equal(pt.ctx.intent, 'fire');
  const it = ask('Investire 300 € al mese per 20 anni al 6%', {}, 'it', 'it');
  assert.equal(it.lang, 'it'); assert.equal(it.ctx.intent, 'sip'); assert.equal(it.ctx.values.monthly, 300); assert.equal(it.ctx.values.years, 20);
});

test('starter chips are understood in every language', () => {
  const map = { en: 'us', hi: 'in', es: 'mx', fr: 'fr', de: 'de', it: 'it', pt: 'br', ja: 'jp', zh: 'cn', ko: 'kr', ar: 'sa', id: 'id' };
  for (const [lang, country] of Object.entries(map)) {
    const chips = starterChips(country, lang);
    const intents = chips.slice(0, 4).map(q => respond(q, {}, country, lang).ctx.intent);
    assert.deepEqual(intents, ['emi', 'mortgage', 'sip', 'fire'], `${lang}: ${chips.join(' | ')} -> ${intents}`);
    assert.ok(respond(chips[4], {}, country, lang).title, `${lang} glossary chip`);
  }
});

test('follow-up chips work in every language', () => {
  const map = { en: 'us', hi: 'in', es: 'mx', fr: 'fr', de: 'de', it: 'it', pt: 'br', ja: 'jp', zh: 'cn', ko: 'kr', ar: 'sa', id: 'id' };
  for (const [lang, country] of Object.entries(map)) {
    const first = respond(starterChips(country, lang)[0], {}, country, lang);
    const lower = respond(first.chips[0], first.ctx, country, lang);
    assert.ok(Math.abs(lower.ctx.values.ratePct - (first.ctx.values.ratePct - 1)) < 1e-9, `${lang} lower: ${first.chips[0]}`);
    const longer = respond(first.chips[1], first.ctx, country, lang);
    assert.equal(longer.ctx.values.years, 10, `${lang} longer: ${first.chips[1]}`);
    const m = respond(starterChips(country, lang)[1], {}, country, lang);
    const more = respond(m.chips[0], m.ctx, country, lang);
    assert.ok(more.ctx.values.extra > m.ctx.values.extra, `${lang} more: ${m.chips[0]}`);
  }
});

test('retirement sentence with age, spend, savings', () => {
  const r = ask("I'm 32, spend 3000 a month, have 80k saved and invest 1500 a month. When can I retire?");
  assert.equal(r.ctx.intent, 'fire');
  assert.equal(r.ctx.values.age, 32);
  assert.equal(r.ctx.values.annualSpend, 36000);
  assert.equal(r.ctx.values.savings, 80000);
  assert.equal(r.ctx.values.monthly, 1500);
});

test('debts go to the planner', () => {
  const r = ask('I owe 18k on 3 cards at 24%, can pay 900 a month');
  assert.ok(r.link.href.startsWith('#debt'));
});

test('number parsing helpers', () => {
  assert.equal(parseAmount('2,50,000'), 250000);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('3억'), 300000000);
  assert.deepEqual(amounts(normalize('٥٠٠٠٠ درهم')).map(a => a.value), [50000]);
  assert.equal(detectLang('Wann kann ich in Rente gehen?', 'en'), 'de');
});

test('Mexico uses comma thousands even in Spanish', () => {
  const r = respond('Préstamo de $150,000 al 18% a 5 años', {}, 'mx', 'es');
  assert.equal(r.ctx.values.principal, 150000);
  const de = respond('Kredit über 1.500,50 € zu 5 % für 2 Jahre', {}, 'de', 'de');
  assert.equal(de.ctx.values.principal, 1500.5);
});
