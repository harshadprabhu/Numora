// Rules-based insight engine: re-runs the engine with small changes,
// ranks them by impact and writes plain-language advice from templates. No AI.
import { mortgagePayoff, debtPayoff } from './engine.js';

export function mortgageInsights(inputs, result, f, step) {
  const levers = [];
  const cur = result.plan;
  const tryLever = (label, changed, kind) => {
    const r = mortgagePayoff({ ...inputs, ...changed });
    if (r.plan.neverPaysOff || cur.neverPaysOff) return;
    const months = cur.months - r.plan.months;
    const saved = cur.totalInterest - r.plan.totalInterest;
    if (months > 0 && saved > 0) levers.push({ label, months, saved, kind });
  };
  for (const mult of [1, 2, 5]) {
    const add = step * mult;
    tryLever(add, { extra: (inputs.extra || 0) + add }, 'extra');
  }
  tryLever(step * 50, { lumpSum: (inputs.lumpSum || 0) + step * 50, lumpMonth: 12 }, 'lump');
  if (inputs.ratePct > 0.75) tryLever(0.5, { ratePct: inputs.ratePct - 0.5 }, 'rate');

  // Rank: interest saved, but prefer the smallest monthly extra when savings are similar.
  levers.sort((a, b) => b.saved - a.saved);
  const extraLevers = levers.filter(l => l.kind === 'extra');
  const picks = [];
  if (extraLevers.length) picks.push(extraLevers[extraLevers.length - 1]); // smallest, easiest
  if (extraLevers.length > 1) picks.push(extraLevers[0]); // biggest impact
  for (const l of levers) if (l.kind !== 'extra' && picks.length < 3) picks.push(l);

  const out = picks.slice(0, 3).map(l => {
    if (l.kind === 'extra') return {
      tone: 'good',
      text: `${(inputs.extra || 0) > 0 ? 'Adding another' : 'Paying'} ${f.money(l.label)} ${(inputs.extra || 0) > 0 ? 'a month' : 'more each month'} clears it ${f.duration(l.months)} sooner and saves ${f.money(l.saved)} in interest.`,
    };
    if (l.kind === 'lump') return {
      tone: 'good',
      text: `A one-off ${f.money(l.label)} payment in a year's time cuts ${f.duration(l.months)} off and saves ${f.money(l.saved)}.`,
    };
    return {
      tone: 'good',
      text: `Getting a rate 0.5 points lower would save ${f.money(l.saved)}. Worth comparing deals when your current rate period ends.`,
    };
  });

  if (result.plan.neverPaysOff) {
    out.unshift({ tone: 'warn', text: 'With these numbers the balance never falls: the payment is smaller than the interest charged each month.' });
  } else if ((inputs.extra || 0) > 0 && result.interestSaved > 0) {
    out.unshift({ tone: 'good', text: `Your current plan already saves ${f.money(result.interestSaved)} and ${f.duration(result.monthsSaved)} compared with the minimum payment.` });
  }
  if (inputs.ratePct === 0) {
    out.push({ tone: 'neutral', text: 'At 0% interest, paying early saves no money. It only frees you from the payment sooner, so keeping cash for savings or emergencies may suit you better.' });
  }
  const interestShare =result.base.totalInterest / (result.base.totalInterest + inputs.balance);
  if (Number.isFinite(interestShare) && interestShare > 0.4) {
    out.push({ tone: 'warn', text: `On the minimum payment, ${Math.round(interestShare * 100)}% of everything you pay goes to interest.` });
  }
  return out.slice(0, 4);
}

export function debtInsights(debts, budget, results, f, step) {
  const { avalanche, snowball } = results;
  const out = [];
  if (avalanche.error || snowball.error) {
    if (avalanche.error === 'budget-below-minimums') {
      out.push({ tone: 'warn', text: `Your budget is below the minimum payments (${f.money(avalanche.minTotal)}). Raise it, or ask lenders about hardship plans.` });
    } else {
      out.push({ tone: 'warn', text: 'At this budget the total debt is not going down. Increase the monthly amount.' });
    }
    return out;
  }
  const diff = snowball.totalInterest - avalanche.totalInterest;
  if (diff > 1) {
    out.push({ tone: 'good', text: `Avalanche (highest rate first) saves ${f.money(diff)} in interest compared with snowball.` });
  } else {
    out.push({ tone: 'good', text: 'Both methods cost about the same here, so snowball is a fine choice if quick wins keep you motivated.' });
  }
  const firstSnow = snowball.order[0], firstAva = avalanche.order[0];
  if (firstSnow && firstAva && firstSnow.month < firstAva.month) {
    out.push({ tone: 'neutral', text: `Snowball clears ${firstSnow.name} first, in ${f.duration(firstSnow.month)}: a quicker first win.` });
  }
  for (const mult of [1, 3]) {
    const r = debtPayoff(debts, budget + step * mult, 'avalanche');
    if (!r.error && r.months < avalanche.months) {
      out.push({ tone: 'good', text: `Adding ${f.money(step * mult)} a month makes you debt-free ${f.duration(avalanche.months - r.months)} sooner and saves ${f.money(avalanche.totalInterest - r.totalInterest)}.` });
      break;
    }
  }
  const worst = [...debts].sort((a, b) => b.apr - a.apr)[0];
  if (worst && worst.apr >= 20) {
    out.push({ tone: 'warn', text: `${worst.name} charges ${worst.apr}% a year. Moving it to a lower-rate option would cut your cost the most.` });
  }
  return out.slice(0, 4);
}
