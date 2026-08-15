import { secondaryEffects } from './effects.js';
import { inclinedDrop } from './incline.js';

/**
 * Point-mass trajectory solver on the standard G1/G7 drag models.
 *
 * The previous dope card used a single exponential decay with a hand-tuned
 * fudge factor. That is fine to about 300 yards and increasingly wrong past it,
 * because real drag is strongly non-linear through the transonic region — Cd
 * roughly triples between Mach 0.9 and Mach 1.0 on G7. A model that misses that
 * cannot be trusted where the dope actually matters.
 *
 * This integrates the equations of motion against the published drag tables
 * instead, so transonic behaviour comes out of the data rather than a constant.
 *
 * Conventions: feet and ft/s internally, yards and inches at the boundary.
 */

// Standard drag tables: Cd against Mach number.
//
// G1 = flat-base reference projectile; G7 = boat-tail, the better match for
// modern long-range bullets, which is why G7 BCs stay flatter across velocity.
//
// Provenance, because it is the line that matters here. These are the standard
// G1 and G7 drag functions: reference-projectile drag curves originating in the
// Gavre Commission work and the US Army Ballistic Research Laboratory, in the
// public domain for over a century, tabulated identically in every exterior
// ballistics text and by JBM. They describe two imaginary standard projectiles,
// not any real bullet.
//
// What is deliberately NOT here is measured ballistic coefficients for actual
// bullets. Those are somebody's laboratory product - Litz's in particular - and
// transcribing them would be taking the work rather than the method. The app
// does not need them: BC is an input the shooter supplies from the box, and
// trueBC solves it backwards from their own dope, which beats a published
// figure for their rifle anyway.
//
// Spot checks against the standard tables: G1 Cd is 0.2629 at Mach 0 and peaks
// near 0.6625 around Mach 1.4; G7 is 0.1198 at Mach 0 and peaks near 0.4043
// around Mach 1.05. See scripts/test-ballistics.mjs.
const G1 = [
  [0.00, 0.2629], [0.05, 0.2558], [0.10, 0.2487], [0.15, 0.2413], [0.20, 0.2344],
  [0.25, 0.2278], [0.30, 0.2214], [0.35, 0.2155], [0.40, 0.2104], [0.45, 0.2061],
  [0.50, 0.2032], [0.55, 0.2020], [0.60, 0.2034], [0.70, 0.2165], [0.725, 0.2230],
  [0.75, 0.2313], [0.775, 0.2417], [0.80, 0.2546], [0.825, 0.2706], [0.85, 0.2901],
  [0.875, 0.3136], [0.90, 0.3415], [0.925, 0.3734], [0.95, 0.4084], [0.975, 0.4448],
  [1.00, 0.4805], [1.025, 0.5136], [1.05, 0.5427], [1.075, 0.5677], [1.10, 0.5883],
  [1.125, 0.6053], [1.15, 0.6191], [1.20, 0.6393], [1.25, 0.6518], [1.30, 0.6589],
  [1.35, 0.6621], [1.40, 0.6625], [1.45, 0.6607], [1.50, 0.6573], [1.55, 0.6528],
  [1.60, 0.6474], [1.65, 0.6413], [1.70, 0.6347], [1.75, 0.6280], [1.80, 0.6210],
  [1.85, 0.6141], [1.90, 0.6072], [1.95, 0.6003], [2.00, 0.5934], [2.05, 0.5867],
  [2.10, 0.5804], [2.15, 0.5743], [2.20, 0.5685], [2.25, 0.5630], [2.30, 0.5577],
  [2.35, 0.5527], [2.40, 0.5481], [2.45, 0.5438], [2.50, 0.5397], [2.60, 0.5325],
  [2.70, 0.5264], [2.80, 0.5211], [2.90, 0.5168], [3.00, 0.5133], [3.20, 0.5084],
  [3.40, 0.5054], [3.60, 0.5030], [3.80, 0.5016], [4.00, 0.5006],
];

const G7 = [
  [0.00, 0.1198], [0.05, 0.1197], [0.10, 0.1196], [0.15, 0.1194], [0.20, 0.1193],
  [0.25, 0.1194], [0.30, 0.1194], [0.35, 0.1194], [0.40, 0.1193], [0.45, 0.1193],
  [0.50, 0.1194], [0.55, 0.1193], [0.60, 0.1194], [0.65, 0.1197], [0.70, 0.1202],
  [0.75, 0.1215], [0.775, 0.1226], [0.80, 0.1242], [0.825, 0.1266], [0.85, 0.1306],
  [0.875, 0.1368], [0.90, 0.1464], [0.925, 0.1660], [0.95, 0.2054], [0.975, 0.2993],
  [1.00, 0.3803], [1.025, 0.4015], [1.05, 0.4043], [1.075, 0.4034], [1.10, 0.4014],
  [1.125, 0.3987], [1.15, 0.3955], [1.20, 0.3884], [1.25, 0.3810], [1.30, 0.3732],
  [1.35, 0.3657], [1.40, 0.3580], [1.50, 0.3440], [1.55, 0.3376], [1.60, 0.3315],
  [1.65, 0.3260], [1.70, 0.3209], [1.75, 0.3160], [1.80, 0.3117], [1.85, 0.3078],
  [1.90, 0.3042], [1.95, 0.3010], [2.00, 0.2980], [2.05, 0.2951], [2.10, 0.2922],
  [2.15, 0.2892], [2.20, 0.2864], [2.25, 0.2835], [2.30, 0.2807], [2.35, 0.2779],
  [2.40, 0.2752], [2.45, 0.2725], [2.50, 0.2697], [2.60, 0.2643], [2.70, 0.2588],
  [2.80, 0.2533], [2.90, 0.2479], [3.00, 0.2424], [3.20, 0.2313], [3.40, 0.2205],
  [3.60, 0.2106], [3.80, 0.2017], [4.00, 0.1935],
];

const TABLES = { G1, G7 };

/**
 * Cd for a standard drag function at a given Mach number.
 *
 * Exported so the tables themselves can be checked rather than trusted: the
 * harness asserts the anchor values that identify G1 and G7, which is what
 * catches a transcription slip in a list of 140 numbers nobody reads.
 */
export function standardCd(model, mach) {
  const table = String(model).toUpperCase() === 'G1' ? G1 : G7;
  return dragCoefficient(table, mach);
}

/** Linear interpolation into a drag table, clamped at both ends. */
function dragCoefficient(table, mach) {
  if (mach <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (mach >= last[0]) return last[1];
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid][0] <= mach) lo = mid; else hi = mid;
  }
  const [m0, c0] = table[lo], [m1, c1] = table[hi];
  return c0 + (c1 - c0) * (mach - m0) / (m1 - m0);
}

/** Coerce a value that may have arrived from a TextInput as a string. */
const N = (v, d) => { const n = Number(v); return isFinite(n) ? n : d; };

const STD_DENSITY = 0.0764742;  // lb/ft^3 at 59F, 29.92 inHg, dry
const STD_TEMP_F = 59;

/** Saturation vapour pressure over water, inHg (Tetens). */
function saturationVapourPressure(tempF) {
  const tC = (tempF - 32) * 5 / 9;
  const hPa = 6.1078 * Math.pow(10, (7.5 * tC) / (tC + 237.3));
  return hPa * 0.02953;
}

/**
 * Air density ratio against the standard atmosphere.
 *
 * Humidity *lowers* density — water vapour is lighter than dry air — which is
 * the opposite of what most people assume, though the effect is small next to
 * temperature and pressure.
 */
export function densityRatio({ tempF = STD_TEMP_F, pressureInHg = 29.92, humidityPct = 0 } = {}) {
  const tempR = tempF + 459.67;
  const pv = (humidityPct / 100) * saturationVapourPressure(tempF);
  const pd = pressureInHg - pv;
  // Densities scale with partial pressures over their gas constants.
  const density = (pd / (0.37373 * tempR)) + (pv / (0.59912 * tempR));
  const stdDensity = 29.92 / (0.37373 * (STD_TEMP_F + 459.67));
  return (density / stdDensity);
}

/** Speed of sound in ft/s. Depends on temperature only. */
export function speedOfSound(tempF = STD_TEMP_F) {
  return 49.0223 * Math.sqrt(tempF + 459.67);
}

/**
 * Station pressure from altitude, for when the user has altitude but not a
 * barometer reading.
 */
export function pressureAtAltitude(altitudeFt, seaLevelInHg = 29.92) {
  return seaLevelInHg * Math.pow(1 - 6.8756e-6 * altitudeFt, 5.2559);
}

/**
 * Drag deceleration constant.
 *
 * a = k * rho_ratio * Cd(M) * v^2 / BC, derived from a = rho v^2 Cd A / 2m with
 * BC = m/(d^2 i), mass in pounds and area in square inches:
 *   k = (1/2) * 32.174 * (pi/576) * rho_std_slug
 */
const DRAG_K = 0.5 * 32.174 * (Math.PI / 576) * (STD_DENSITY / 32.174);

/**
 * Integrate a trajectory.
 *
 * @param opts.mvFps        muzzle velocity
 * @param opts.bc           ballistic coefficient in the chosen model
 * @param opts.dragModel    'G1' | 'G7'
 * @param opts.sightHeightIn scope centre above bore
 * @param opts.zeroYd       range the rifle is zeroed at
 * @param opts.windMph      wind speed
 * @param opts.windAngleDeg clock angle; 90 is a full-value crosswind from the
 *                          left, 0 is a pure headwind
 * @param opts.maxRangeYd / opts.stepYd  table extent and spacing
 */
export function solve(opts = {}) {
  const {
    mvFps = 2800, bc = 0.5, dragModel = 'G7',
    sightHeightIn = 1.5, zeroYd = 100,
    tempF = STD_TEMP_F, pressureInHg = 29.92, humidityPct = 0, altitudeFt = null,
    windMph = 0, windAngleDeg = 90,
    maxRangeYd = 1000, stepYd = 100,
    muzzleAngleRad = null,
  } = opts;

  // Coerce every numeric input. These arrive from TextInputs as strings, and a
  // string stepYd turned `r += stepYd` in the range loop below into
  // concatenation — '1000' + '1000' = '10001000', which stays lexicographically
  // less than the limit forever and hangs the thread.
  const _mv = N(mvFps, 2800), _bc = N(bc, 0.5);
  const _sight = N(sightHeightIn, 1.5), _zero = N(zeroYd, 100);
  const _maxRange = N(maxRangeYd, 1000), _step = Math.max(1, N(stepYd, 100));
  const _wind = N(windMph, 0), _windAngle = N(windAngleDeg, 90);

  // A measured curve replaces the standard table, and takes sectional density
  // with it. See lib/dragfn.js: a custom Cd already carries the form factor, so
  // dividing by BC as well would apply it twice. Both are required together -
  // a curve without a sectional density falls back to the standard model rather
  // than guessing a divisor, because guessing would produce a card that solves
  // and is wrong, which is the one outcome nothing downstream could detect.
  const { dragCurve = null, sectionalDensity = null } = opts;
  const _sd = Number(sectionalDensity);
  const useCurve = Array.isArray(dragCurve) && dragCurve.length >= 2 && isFinite(_sd) && _sd > 0;
  const table = useCurve ? dragCurve : (TABLES[dragModel] || G7);
  const divisor = useCurve ? _sd : _bc;

  const rawPressure = N(pressureInHg, 29.92);
  const alt = altitudeFt == null || altitudeFt === '' ? null : N(altitudeFt, null);
  const pressure = alt != null ? pressureAtAltitude(alt, rawPressure) : rawPressure;
  const rho = densityRatio({ tempF: N(tempF, STD_TEMP_F), pressureInHg: pressure, humidityPct: N(humidityPct, 0) });
  const sos = speedOfSound(N(tempF, STD_TEMP_F));

  // Crosswind pushes laterally; the headwind component slightly changes drag.
  const wa = _windAngle * Math.PI / 180;
  const windCross = _wind * 1.46667 * Math.sin(wa);
  const windHead = _wind * 1.46667 * Math.cos(wa);

  const angle = muzzleAngleRad ?? zeroAngle({ ...opts, dragModel, bc: _bc, mvFps: _mv, zeroYd: _zero, sightHeightIn: _sight });

  const dt = 0.0005;
  const maxRangeFt = _maxRange * 3;

  let x = 0;
  let y = -_sight / 12;          // bore starts below the line of sight
  let z = 0;                     // lateral
  let vx = _mv * Math.cos(angle);
  let vy = _mv * Math.sin(angle);
  let t = 0;

  const wanted = [];
  for (let r = _step; r <= _maxRange + 1e-9; r += _step) wanted.push(r);
  const rows = [];
  let next = 0;

  let vz = 0;

  while (x < maxRangeFt && t < 20) {
    // Drag acts on velocity relative to the air mass, so the wind enters here
    // rather than as a separate correction. Lateral drift then falls out of the
    // integration: the bullet starts with no sideways speed, drag accelerates
    // it toward the air mass's, and it never fully catches up.
    const relVx = vx - windHead;
    const relVz = vz - windCross;
    const v = Math.sqrt(relVx * relVx + vy * vy + relVz * relVz);
    if (v <= 0) break;

    const cd = dragCoefficient(table, v / sos);
    const decel = DRAG_K * rho * cd * v * v / divisor;

    const ax = -decel * (relVx / v);
    const ay = -decel * (vy / v) - 32.174;
    const az = -decel * (relVz / v);

    const px = x;
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;
    t += dt;

    // A bullet that has stopped advancing will never reach the next range, so
    // without this the loop runs to its time cap. That matters because the
    // zero solver calls solve() in a tight loop and a diverged trial angle can
    // send the bullet nearly vertical — the difference between milliseconds
    // and a hung UI thread.
    if (vx <= 0 || !isFinite(x) || !isFinite(y)) break;

    if (next < wanted.length) {
      const targetFt = wanted[next] * 3;
      if (px <= targetFt && x >= targetFt) {
        const frac = (targetFt - px) / (x - px || 1);
        rows.push({
          rangeYd: wanted[next],
          dropIn: (y) * 12,
          velFps: Math.sqrt(vx * vx + vy * vy),
          machAtRange: Math.sqrt(vx * vx + vy * vy) / sos,
          tofSec: t,
          windIn: z * 12,
        });
        next++;
      }
    }
  }

  return { rows, densityRatio: rho, speedOfSound: sos, muzzleAngleRad: angle };
}

/**
 * Muzzle angle that puts the bullet on the line of sight at the zero range.
 * Secant search on the drop at that distance.
 */
export function zeroAngle(opts = {}) {
  const { zeroYd = 100, sightHeightIn = 1.5 } = opts;
  const dropAt = (angle) => {
    const { rows } = solve({
      ...opts, muzzleAngleRad: angle, windMph: 0,
      maxRangeYd: zeroYd, stepYd: zeroYd,
    });
    return rows.length ? rows[rows.length - 1].dropIn : 0;
  };

  // A launch angle outside this range is unphysical for small arms, and letting
  // the secant wander outside it is how the solver used to hang.
  const MAX_ANGLE = 0.2; // ~11 degrees
  const clamp = (a) => Math.min(MAX_ANGLE, Math.max(-MAX_ANGLE, a));

  let a0 = 0;
  let a1 = clamp((sightHeightIn / 12) / (zeroYd * 3) + 0.001);
  let f0 = dropAt(a0), f1 = dropAt(a1);

  for (let i = 0; i < 30 && Math.abs(f1) > 0.005; i++) {
    const denom = f1 - f0;
    if (!isFinite(denom) || Math.abs(denom) < 1e-12) break;
    const a2 = clamp(a1 - f1 * (a1 - a0) / denom);
    if (!isFinite(a2)) break;
    a0 = a1; f0 = f1;
    a1 = a2; f1 = dropAt(a1);
    if (!isFinite(f1)) { a1 = a0; break; }
  }
  return a1;
}

/** Inches to MOA / mils at a given range. */
export const inchesToMoa = (inches, rangeYd) => rangeYd ? inches / (1.047 * rangeYd / 100) : 0;
export const inchesToMil = (inches, rangeYd) => rangeYd ? inches / (3.6 * rangeYd / 100) : 0;

/**
 * Build a dope card with elevation and wind in the requested unit.
 */
/**
 * @param opts.effects  Optional. When supplied, spin drift, aerodynamic jump
 *   and Coriolis are folded into the elevation and windage the card prints,
 *   rather than being left in a panel the shooter has to add up themselves.
 *   `{ sg, lengthCalibers, rightHandTwist, latitudeDeg, azimuthDeg }`.
 *
 * Folding them in is the point. The app computed all three, checked them
 * against published forms, and then printed a card that excluded them - and
 * said so, in a panel next to it. They come to roughly a minute at 1000 yards,
 * which is a miss on a small plate. A shooter carrying the card was carrying
 * numbers the app knew were incomplete.
 *
 * The components are still returned per row, so the card can show its working
 * and the shooter can see which correction is doing what.
 */
export function dopeCard(opts = {}) {
  const { unit = 'moa', effects = null, inclineDeg = 0 } = opts;
  const { rows, densityRatio: rho } = solve(opts);
  const conv = unit === 'mil' ? inchesToMil : inchesToMoa;

  // Aerodynamic jump responds to the crosswind component, not the wind speed.
  const wa = N(opts.windAngleDeg, 90) * Math.PI / 180;
  const crosswindMph = N(opts.windMph, 0) * Math.sin(wa);

  const usable = effects && effects.sg > 0 && effects.lengthCalibers > 0;

  return {
    densityRatio: rho,
    includesEffects: !!usable,
    inclineDeg: N(inclineDeg, 0),
    rows: rows.map(r => {
      const sec = usable
        ? secondaryEffects({
            sg: effects.sg,
            lengthCalibers: effects.lengthCalibers,
            timeOfFlightSec: r.tofSec,
            rangeFt: r.rangeYd * 3,
            crosswindMph,
            rightHandTwist: effects.rightHandTwist !== false,
            latitudeDeg: effects.latitudeDeg ?? null,
            azimuthDeg: effects.azimuthDeg ?? 0,
          })
        : null;

      // The angle scales *gravity* drop and nothing else. Aerodynamic jump and
      // the Coriolis vertical are not gravity, so they are added after the
      // cosine rather than through it - scaling them too would be applying a
      // correction to a quantity it does not describe.
      const gravity = inclinedDrop(r.dropIn, inclineDeg);
      // Vertical effects raise the impact, so they reduce the elevation dialled.
      // dropIn is negative below the line of sight, hence the sign.
      const dropWith = gravity + (sec?.totalVerticalIn ?? 0);
      // Lateral effects add to wind drift in the same sense: positive is right.
      const lateral = r.windIn + (sec?.totalHorizontalIn ?? 0);

      return {
        rangeYd: r.rangeYd,
        dropIn: +dropWith.toFixed(2),
        elevation: +conv(-dropWith, r.rangeYd).toFixed(2),
        windIn: +lateral.toFixed(2),
        wind: +conv(Math.abs(lateral), r.rangeYd).toFixed(2),
        // Signed, so a card can say which way to hold rather than only how far.
        windRight: lateral >= 0,
        velFps: Math.round(r.velFps),
        mach: +r.machAtRange.toFixed(2),
        tofSec: +r.tofSec.toFixed(3),
        // The working, so the total is auditable rather than magic.
        spinDriftIn: sec ? sec.spinDriftIn : 0,
        aeroJumpIn: sec ? sec.aeroJumpIn : 0,
        coriolisHIn: sec?.coriolis ? +sec.coriolis.horizontalIn.toFixed(2) : 0,
        coriolisVIn: sec?.coriolis ? +sec.coriolis.verticalIn.toFixed(2) : 0,
        // Past about Mach 1.2 the bullet enters transonic buffeting, where drag
        // models lose accuracy and groups typically open up.
        transonic: r.machAtRange < 1.2,
      };
    }),
  };
}

/**
 * Wind as a bracket, not a single number.
 *
 * The card is solved for one wind speed, and nobody knows the wind — they
 * estimate it. Drift is exactly linear in wind speed, which the solver already
 * knows, so the whole table can be produced from one solve and the field
 * arithmetic becomes "call it eight, read the eight column".
 *
 * Deliberately drift only. Aerodynamic jump also scales with crosswind and is
 * *vertical*, so folding it into a horizontal bracket would be wrong; it stays
 * in the elevation column where it belongs.
 */
export function windBracket(opts = {}, speeds = [5, 10, 15, 20]) {
  const { unit = 'moa' } = opts;
  const conv = unit === 'mil' ? inchesToMil : inchesToMoa;
  // One solve at a reference speed; everything else is proportional.
  const REF = 10;
  const { rows } = solve({ ...opts, windMph: REF, windAngleDeg: 90 });
  return {
    speeds,
    rows: rows.map(r => ({
      rangeYd: r.rangeYd,
      perMph: +conv(Math.abs(r.windIn) / REF, r.rangeYd).toFixed(3),
      holds: speeds.map(v => +conv(Math.abs(r.windIn) * (v / REF), r.rangeYd).toFixed(2)),
    })),
  };
}

/**
 * Trued BC from an observed drop.
 *
 * Solves for the BC that reproduces what the shooter actually saw at a known
 * distance. Real BCs vary from the box figure with barrel, atmosphere and
 * bullet lot, and truing is how a card is made to match the rifle rather than
 * the catalogue.
 */
export function trueBC(opts, observations) {
  const valid = (observations || []).filter(o =>
    isFinite(o.rangeYd) && o.rangeYd > 0 && isFinite(o.observedElevation));
  if (!valid.length) return null;

  const err = (bc) => {
    let sum = 0;
    for (const o of valid) {
      const { rows } = solve({ ...opts, bc, maxRangeYd: o.rangeYd, stepYd: o.rangeYd });
      const row = rows[rows.length - 1];
      if (!row) continue;
      const conv = opts.unit === 'mil' ? inchesToMil : inchesToMoa;
      sum += conv(-row.dropIn, o.rangeYd) - o.observedElevation;
    }
    return sum / valid.length;
  };

  // A higher BC means less drop, so the error is monotonic in BC — bisect.
  let lo = opts.bc * 0.5, hi = opts.bc * 1.8;
  let fLo = err(lo);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const fMid = err(mid);
    if (Math.abs(fMid) < 0.005) { lo = hi = mid; break; }
    if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
  }
  const trued = (lo + hi) / 2;
  return {
    bc: +trued.toFixed(4),
    factor: +(trued / opts.bc).toFixed(3),
    observations: valid.length,
  };
}
