/**
 * Round count, barrel life and ammunition lot tracking.
 *
 * Two very different kinds of claim live in this file, and keeping them apart is
 * the whole point.
 *
 * The published barrel-life figures below are community estimates with enormous
 * spread. Accuracy life depends on charge relative to case capacity, rate of
 * fire, how hot the barrel is allowed to get, steel, and how the throat is
 * cleaned — a 6.5 Creedmoor barrel might lose competitive accuracy at 1,800
 * rounds or hold on past 3,500. Presenting a single number would be false
 * precision, so every entry is a range and is labelled as an estimate.
 *
 * The velocity trend is the opposite: it is the shooter's own measured data, and
 * a significant downward slope in velocity against accumulated rounds at a fixed
 * charge is the actual signature of throat erosion. That is evidence. It is what
 * this module leads with, and the round-count thresholds are only a prompt to go
 * and look.
 *
 * One confounder is named rather than hidden: sessions do not record
 * temperature, and velocity rises with it. A trend built from summer and winter
 * range days carries that variation, so the module reports it as a caveat rather
 * than pretending the slope is erosion alone.
 */

import { fitLine } from './pressure.js';
import { tTestP, welchCompare } from './stats.js';

/**
 * Reported accuracy life in rounds, as [low, high]. Community figures, not
 * measurements — see the note at the top of the file.
 */
const BARREL_LIFE = [
  [/6\s*-?\s*284/i, [1000, 1500]],
  [/6\.5\s*-?\s*284/i, [1000, 1500]],
  [/22\s*creed/i, [1000, 1800]],
  [/6\s*(mm)?\s*creed/i, [1200, 2000]],
  [/6\.5\s*prc/i, [1200, 2000]],
  [/6\s*(mm)?\s*(dasher|br\b|bra\b)/i, [1500, 2500]],
  [/6\s*xc/i, [1500, 2500]],
  [/7\s*(mm)?\s*(rem|prc|saum|wsm)/i, [1500, 2500]],
  [/300\s*(prc|win|wsm|norma)/i, [1500, 2500]],
  [/338\s*(lapua|norma)/i, [1500, 2500]],
  [/6\.5\s*(creed|cm\b)/i, [2000, 3000]],
  [/6\.5\s*x\s*47/i, [2000, 3000]],
  [/284\s*win/i, [2000, 3000]],
  [/6\.5\s*grendel/i, [3000, 5000]],
  [/308\s*win|7\.62\s*x\s*51/i, [4000, 6000]],
  [/223|5\.56/i, [4000, 6000]],
  [/22\s*lr|\.22lr/i, [50000, 100000]],
];

export function barrelLifeEstimate(cartridge) {
  const c = String(cartridge || '');
  if (!c.trim()) return null;
  for (const [pattern, range] of BARREL_LIFE) {
    if (pattern.test(c)) return { low: range[0], high: range[1] };
  }
  return null;
}

/**
 * Rounds through a barrel: everything logged, plus whatever was fired before the
 * app existed.
 *
 * `priorRounds` matters more than it looks. Nobody logs every round, and a count
 * that only knows about photographed groups will read a fraction of the truth —
 * which would make every threshold useless.
 */
export function totalRounds(sessions, rifleId, priorRounds = 0) {
  const prior = Number(priorRounds);
  const logged = (sessions || [])
    .filter(s => s.rifleId === rifleId)
    .reduce((sum, s) => {
      const shots = (s.targets || []).reduce((a, t) => a + (t.shots || []).length, 0);
      // Fall back to the recorded velocity count when a session has no plotted
      // target — a chronograph-only string is still rounds down the barrel.
      return sum + (shots || (s.velocities || []).length);
    }, 0);
  return {
    logged,
    prior: isFinite(prior) && prior > 0 ? Math.round(prior) : 0,
    total: logged + (isFinite(prior) && prior > 0 ? Math.round(prior) : 0),
  };
}

/** Where a round count sits against the reported life range. */
export function lifeStatus(total, cartridge) {
  const est = barrelLifeEstimate(cartridge);
  if (!est) return { est: null, reason: 'No published estimate for this cartridge.' };
  const fraction = total / est.high;
  return {
    est,
    fraction: +fraction.toFixed(2),
    // Deliberately coarse. A percentage to two places would imply the estimate
    // supports a precision it does not have.
    stage: total < est.low * 0.5 ? 'early'
      : total < est.low ? 'mid'
      : total < est.high ? 'approaching'
      : 'past',
    note: total < est.low
      ? `Reported accuracy life for this cartridge runs ${est.low}–${est.high} rounds. That is a wide community estimate, not a measurement — your own velocity trend is better evidence.`
      : `At ${total} rounds you are ${total >= est.high ? 'past' : 'inside'} the reported ${est.low}–${est.high} round range. That range is an estimate; check the velocity trend before replacing anything.`,
  };
}

/**
 * Velocity against accumulated rounds, for one load.
 *
 * Requires a single load: comparing velocities across different charges would
 * measure the charge difference, not the barrel.
 *
 * @param points [{ roundCount, velocity }]
 */
export function erosionTrend(points) {
  const clean = (points || [])
    .map(p => ({ roundCount: Number(p.roundCount), velocity: Number(p.velocity) }))
    .filter(p => isFinite(p.roundCount) && isFinite(p.velocity) && p.velocity > 0)
    .sort((a, b) => a.roundCount - b.roundCount);

  if (clean.length < 3) {
    return { ok: false, reason: 'Need velocity from at least 3 sessions with the same load.' };
  }

  const fit = fitLine(clean, 'roundCount', 'velocity');
  if (!fit) return { ok: false, reason: 'All sessions are at the same round count.' };

  // t-test on the slope: is the trend distinguishable from flat?
  const seSlope = fit.residualSd > 0 && fit.sxx > 0
    ? fit.residualSd / Math.sqrt(fit.sxx)
    : 0;
  const t = seSlope > 0 ? fit.slope / seSlope : 0;
  const p = seSlope > 0 ? tTestP(t, clean.length - 2) : null;
  const per100 = fit.slope * 100;
  const spanRounds = clean[clean.length - 1].roundCount - clean[0].roundCount;
  const totalChange = fit.slope * spanRounds;

  const losing = fit.slope < 0 && p != null && p < 0.05;

  return {
    ok: true,
    n: clean.length,
    spanRounds,
    perHundred: +per100.toFixed(1),
    totalChange: +totalChange.toFixed(0),
    p,
    losing,
    // Named, not hidden: without recorded temperature this cannot be separated
    // from seasonal variation.
    caveat: 'Sessions do not record temperature, and velocity rises with it. A trend spanning different seasons carries that variation too.',
    verdict: losing
      ? `Velocity is dropping ${Math.abs(per100).toFixed(1)} fps per 100 rounds — about ${Math.abs(totalChange).toFixed(0)} fps across the ${spanRounds} rounds covered (p = ${p.toFixed(3)}). That is the signature of throat erosion.`
      : fit.slope < 0
        ? `Velocity trends down ${Math.abs(per100).toFixed(1)} fps per 100 rounds, but at p = ${p == null ? '—' : p.toFixed(2)} that is not distinguishable from normal session-to-session variation yet.`
        : `No velocity loss over the ${spanRounds} rounds covered. Nothing here suggests erosion.`,
  };
}

/**
 * Compare two ammunition lots.
 *
 * Velocity is the sound comparison and the one that matters: a lot running 30
 * fps slower changes the drop, which is what actually costs hits at distance.
 *
 * Point of impact is deliberately absent. A POI shift is measured against the
 * point of aim, and the app records where shots landed relative to the reference
 * sheet but never where the shooter was aiming. Inferring it would mean assuming
 * every group was centred on the same spot, and a wrong POI correction is worse
 * than none.
 */
export function compareLots(lotA, lotB) {
  const a = (lotA?.velocities || []).map(Number).filter(v => isFinite(v) && v > 0);
  const b = (lotB?.velocities || []).map(Number).filter(v => isFinite(v) && v > 0);

  if (a.length < 3 || b.length < 3) {
    return { ok: false, reason: 'Need at least 3 velocities from each lot.' };
  }

  const cmp = welchCompare(a, b);
  if (!cmp) return { ok: false, reason: 'Could not compare these lots.' };

  const meanA = a.reduce((x, y) => x + y, 0) / a.length;
  const meanB = b.reduce((x, y) => x + y, 0) / b.length;
  const diff = meanB - meanA;

  return {
    ok: true,
    lotA: { label: lotA.label, n: a.length, mean: +meanA.toFixed(0) },
    lotB: { label: lotB.label, n: b.length, mean: +meanB.toFixed(0) },
    diff: +diff.toFixed(0),
    p: cmp.p,
    significant: cmp.p != null && cmp.p < 0.05,
    verdict: cmp.p != null && cmp.p < 0.05
      ? `${lotB.label} runs ${Math.abs(diff).toFixed(0)} fps ${diff > 0 ? 'faster' : 'slower'} than ${lotA.label} (p = ${cmp.p.toFixed(3)}). Re-confirm your dope — that much changes the drop at distance.`
      : `${Math.abs(diff).toFixed(0)} fps between lots, which at p = ${cmp.p == null ? '—' : cmp.p.toFixed(2)} is within what these string lengths can resolve. Treat them as the same until more shots say otherwise.`,
    poiNote: 'Point of impact is not compared: the app records where shots landed relative to the target sheet, not where you were aiming, so a POI shift cannot be measured from it.',
  };
}
