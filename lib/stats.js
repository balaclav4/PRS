/**
 * Statistics for comparing precision.
 *
 * Two different questions get two different units of replication, and conflating
 * them is the usual way shooting statistics go wrong:
 *
 *   "Does load A shoot smaller groups than B?"  -> the GROUP is the unit.
 *      Group sizes from the same target are one observation. Pooling raw shots
 *      here would inflate n several-fold and manufacture significance.
 *
 *   "How tightly does this rifle disperse shots?" -> the SHOT is the unit.
 *      Sigma is a property of the shot distribution, so every shot offset from
 *      its own target's centre is a legitimate independent sample.
 *
 * Extreme spread — the number everyone quotes — is also a poor statistic: it
 * uses only the two worst shots and its variance grows with shot count, so a
 * 10-shot group is expected to measure larger than a 5-shot group from the same
 * rifle. Mean radius and the Rayleigh sigma below use every shot, so they are
 * far more efficient and comparable across differing shot counts.
 */

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

/** Continued-fraction expansion for the incomplete beta (Lentz's method). */
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function logGamma(z) {
  // Lanczos approximation.
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i] / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularised incomplete beta I_x(a,b). */
export function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? front * betacf(a, b, x) / a
    : 1 - front * betacf(b, a, 1 - x) / b;
}

/** Two-tailed p-value for Student's t. */
export function tTestP(t, df) {
  if (!isFinite(t) || !isFinite(df) || df <= 0) return null;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Critical two-tailed t for a given confidence, by bisection on the CDF. */
export function tCritical(df, conf = 0.95) {
  const target = 1 - conf;
  let lo = 0, hi = 100;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tTestP(mid, df) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Two-tailed p for an F variance ratio. */
export function fTestP(f, df1, df2) {
  if (!isFinite(f) || f <= 0) return null;
  const cdf = incompleteBeta(df1 * f / (df1 * f + df2), df1 / 2, df2 / 2);
  return 2 * Math.min(cdf, 1 - cdf);
}

// ---------------------------------------------------------------------------
// Descriptives
// ---------------------------------------------------------------------------

export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

export function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
}

// ---------------------------------------------------------------------------
// Group-level comparison (unit = group)
// ---------------------------------------------------------------------------

/**
 * Welch's t-test plus the things a p-value alone won't tell you: how big the
 * difference is, how uncertain it is, and how many groups you'd need to settle
 * it.
 */
export function welchCompare(a, b, conf = 0.95) {
  if (a.length < 2 || b.length < 2) return null;

  const ma = mean(a), mb = mean(b);
  const va = sd(a) ** 2, vb = sd(b) ** 2;
  const na = a.length, nb = b.length;

  const se = Math.sqrt(va / na + vb / nb);
  if (se === 0) return null;

  const t = (ma - mb) / se;
  const df = (va / na + vb / nb) ** 2 /
    ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  const p = tTestP(t, df);

  const tCrit = tCritical(df, conf);
  const diff = ma - mb;
  const ci = [diff - tCrit * se, diff + tCrit * se];

  // Cohen's d on the pooled SD — the standardised size of the difference.
  const pooledSd = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
  const d = pooledSd > 0 ? diff / pooledSd : 0;

  return {
    meanA: ma, meanB: mb, sdA: Math.sqrt(va), sdB: Math.sqrt(vb), nA: na, nB: nb,
    diff, ci, t: +t.toFixed(3), df: +df.toFixed(1), p,
    significant: p != null && p < 1 - conf,
    cohenD: +d.toFixed(3),
    // Groups per side needed for 80% power at alpha=.05, normal approximation.
    requiredN: Math.abs(d) > 1e-6 ? Math.ceil(15.7 / (d * d)) : null,
  };
}

/** F-test for whether one side is more *consistent*, not just smaller. */
export function varianceCompare(a, b) {
  if (a.length < 3 || b.length < 3) return null;
  const va = sd(a) ** 2, vb = sd(b) ** 2;
  if (va === 0 || vb === 0) return null;
  const f = va / vb;
  const p = fTestP(f, a.length - 1, b.length - 1);
  return { f: +f.toFixed(3), p, significant: p != null && p < 0.05 };
}

// ---------------------------------------------------------------------------
// Shot-level dispersion (unit = shot)
// ---------------------------------------------------------------------------

/**
 * Rayleigh sigma from shot offsets, by maximum likelihood.
 *
 * offsets are per-shot displacements from their own target's centroid, so each
 * target contributes its own recentred shots. The 2(n-k) denominator corrects
 * for the k centroids having been estimated from the same data — without it
 * sigma comes out biased low.
 */
export function rayleighSigma(offsets, groupCount = 1) {
  const n = offsets.length;
  if (n < 2) return null;
  const ss = offsets.reduce((a, o) => a + o.x * o.x + o.y * o.y, 0);
  const dof = 2 * (n - groupCount);
  if (dof <= 0) return null;
  return Math.sqrt(ss / dof);
}

/** Circular error probable radii: the circle containing p of all shots. */
export function cepRadii(sigma) {
  if (!sigma) return null;
  return {
    r50: sigma * Math.sqrt(-2 * Math.log(0.5)),
    r90: sigma * Math.sqrt(-2 * Math.log(0.10)),
    r95: sigma * Math.sqrt(-2 * Math.log(0.05)),
  };
}

/** Probability a shot lands within `radius` of point of aim. */
export function hitProbability(sigma, radius) {
  if (!sigma || sigma <= 0 || radius <= 0) return 0;
  return 1 - Math.exp(-(radius * radius) / (2 * sigma * sigma));
}

/** Mean radius — the average distance from centre. Uses every shot. */
export function meanRadius(offsets) {
  if (!offsets.length) return null;
  return mean(offsets.map(o => Math.hypot(o.x, o.y)));
}

/**
 * Full dispersion picture for one side of a comparison.
 * `offsets` in MOA, recentred per target; `groupCount` is how many targets.
 */
export function dispersion(offsets, groupCount) {
  const sigma = rayleighSigma(offsets, groupCount);
  if (sigma == null) return null;
  const cep = cepRadii(sigma);
  return {
    n: offsets.length,
    sigma,
    meanRadius: meanRadius(offsets),
    ...cep,
    // Sigma's own uncertainty: SE ~ sigma / sqrt(2(n-k)).
    sigmaSe: sigma / Math.sqrt(2 * Math.max(1, offsets.length - groupCount)),
  };
}
