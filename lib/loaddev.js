/**
 * Charge-ladder analysis.
 *
 * A "node" is a stretch of the ladder where velocity rises slowly with charge
 * weight. The theory is that if dV/dCharge is small, normal powder-throw
 * variation produces less velocity spread, so vertical dispersion at distance
 * shrinks.
 *
 * The theory is also widely disputed, and for a good reason this module makes
 * explicit: with one shot per charge, the velocity you measure is a single
 * draw from a distribution whose SD is typically 10-15 fps. The apparent
 * "flat spot" is then usually noise. So every result here carries the slope
 * uncertainty implied by the shot count, and callers are expected to show it —
 * reporting a node without it would be the same dishonesty as the hardcoded
 * table this replaces.
 */

/** Least-squares slope of v against charge, in fps per grain. */
function slope(rungs) {
  const n = rungs.length;
  if (n < 2) return null;
  const mx = rungs.reduce((a, r) => a + r.charge, 0) / n;
  const my = rungs.reduce((a, r) => a + r.velocity, 0) / n;
  let num = 0, den = 0;
  for (const r of rungs) {
    num += (r.charge - mx) * (r.velocity - my);
    den += (r.charge - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

/**
 * Parse loose UI rows into clean numeric rungs, dropping incomplete ones.
 * Rows are strings straight from TextInputs.
 */
export function parseRungs(rows) {
  return rows
    .map(r => ({
      id: r.id,
      charge: parseFloat(r.charge),
      velocity: parseFloat(r.velocity),
      groupMoa: r.groupMoa === '' || r.groupMoa == null ? null : parseFloat(r.groupMoa),
    }))
    .filter(r => isFinite(r.charge) && isFinite(r.velocity))
    .sort((a, b) => a.charge - b.charge);
}

/**
 * Residual velocity SD around the ladder's overall linear trend.
 *
 * With one shot per charge this is the only handle on shot-to-shot noise, and
 * it is itself a poor estimate — hence `weak` once the ladder is short.
 */
export function residualSd(rungs) {
  const n = rungs.length;
  if (n < 3) return { sd: null, weak: true };
  const k = slope(rungs);
  if (k == null) return { sd: null, weak: true };
  const mx = rungs.reduce((a, r) => a + r.charge, 0) / n;
  const my = rungs.reduce((a, r) => a + r.velocity, 0) / n;
  let ss = 0;
  for (const r of rungs) {
    const pred = my + k * (r.charge - mx);
    ss += (r.velocity - pred) ** 2;
  }
  // n-2 degrees of freedom: the fit consumed a slope and an intercept.
  return { sd: Math.sqrt(ss / (n - 2)), weak: n < 5 };
}

/**
 * Find the flattest window in the ladder and say whether it is distinguishable
 * from noise.
 *
 * @param rungs   sorted, cleaned rungs from parseRungs()
 * @param options.windowSize  rungs per window (3 is the usual ladder practice)
 * @param options.shotsPerCharge  averaging over more shots tightens the slope
 * @param options.assumedSd   fallback velocity SD when the ladder is too short
 *                            to estimate one; 15 fps is typical for a decent
 *                            handload
 */
export function findNode(rungs, options = {}) {
  const { windowSize = 3, shotsPerCharge = 1, assumedSd = 15 } = options;

  if (rungs.length < windowSize) {
    return { node: null, reason: `Need at least ${windowSize} rungs with charge and velocity.` };
  }

  const overall = slope(rungs);
  if (overall == null || overall <= 0) {
    return { node: null, reason: 'Velocity does not rise with charge — check the entries.' };
  }

  let best = null;
  for (let i = 0; i + windowSize <= rungs.length; i++) {
    const win = rungs.slice(i, i + windowSize);
    const k = slope(win);
    if (k == null) continue;
    if (!best || Math.abs(k) < Math.abs(best.slope)) {
      best = { slope: k, rungs: win, startIndex: i };
    }
  }
  if (!best) return { node: null, reason: 'Could not fit a slope — charges may be duplicated.' };

  const est = residualSd(rungs);
  const sd = est.sd ?? assumedSd;
  // Averaging n shots at each charge cuts the per-point SD by sqrt(n).
  const pointSd = sd / Math.sqrt(Math.max(1, shotsPerCharge));

  // SE of a least-squares slope: sigma / sqrt(Sxx) over the window.
  const mx = best.rungs.reduce((a, r) => a + r.charge, 0) / best.rungs.length;
  const sxx = best.rungs.reduce((a, r) => a + (r.charge - mx) ** 2, 0);
  const slopeSe = sxx > 0 ? pointSd / Math.sqrt(sxx) : Infinity;

  // Is the window meaningfully flatter than the ladder as a whole?
  const flatteningZ = slopeSe > 0 ? (overall - best.slope) / slopeSe : 0;
  const significant = flatteningZ >= 2;

  const centre = best.rungs[Math.floor(best.rungs.length / 2)];
  const span = [best.rungs[0].charge, best.rungs[best.rungs.length - 1].charge];

  return {
    node: {
      centreCharge: centre.charge,
      spanGr: span,
      slope: +best.slope.toFixed(1),
      overallSlope: +overall.toFixed(1),
      slopeSe: +slopeSe.toFixed(1),
      flatteningZ: +flatteningZ.toFixed(2),
      significant,
      velocityAtCentre: centre.velocity,
      groupMoa: centre.groupMoa,
    },
    velocitySd: est.sd == null ? null : +est.sd.toFixed(1),
    sdIsAssumed: est.sd == null,
    sdIsWeak: est.weak,
    // The honest headline. Callers show this verbatim rather than inventing one.
    verdict: significant
      ? `Flat spot at ${centre.charge}gr is ${flatteningZ.toFixed(1)}x the slope uncertainty — worth confirming with a longer string.`
      : `Flattest window is at ${centre.charge}gr, but it is within noise (${flatteningZ.toFixed(1)}x uncertainty). One shot per charge cannot separate a real node from chance — shoot 3-5 per charge to tell.`,
  };
}

/**
 * Best group in the ladder, when group sizes were recorded.
 *
 * The null check is load-bearing: isFinite(null) is true in JS because
 * Number(null) is 0, so a rung with no group entered would otherwise win as a
 * perfect 0.00 MOA group.
 */
export function bestGroup(rungs) {
  const withGroups = rungs.filter(r => r.groupMoa != null && isFinite(r.groupMoa));
  if (!withGroups.length) return null;
  return withGroups.reduce((a, b) => (b.groupMoa < a.groupMoa ? b : a));
}
