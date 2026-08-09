/**
 * Custom drag functions: a bullet's own drag curve instead of a coefficient.
 *
 * A ballistic coefficient is a fudge. It says "this bullet behaves like the G7
 * standard projectile, scaled by 0.315", which is a good approximation over the
 * velocities where the BC was measured and a worse one everywhere else -
 * particularly through transonic, where real bullets diverge from the reference
 * shape most.
 *
 * A measured drag curve skips the comparison entirely. Cd against Mach for that
 * bullet, from a Doppler radar, used directly. The solver here already
 * interpolates exactly that shape for G1 and G7, so a custom curve is not a new
 * kind of input, it is the same input with better numbers in it.
 *
 * Lapua publish radar-measured curves for their bullets and released them for
 * use in ballistics software. That is the intended source. The parser is
 * deliberately format-tolerant rather than tied to one vendor's file: two
 * numbers per line, Mach first, in whatever punctuation the file arrived with.
 *
 * Provenance is required, not optional. A curve with no recorded origin is
 * indistinguishable from one somebody typed, and six months later nobody can
 * tell whether it may be redistributed or where it came from.
 */

/**
 * Parse a Mach/Cd table out of whatever the file looks like.
 *
 * Accepts comma, tab, semicolon or whitespace separation, tolerates a header
 * row, comment lines and a decimal comma. Rejects anything that does not end up
 * looking like a drag curve, because a half-parsed curve is worse than a
 * refused one: it would solve, and it would be wrong.
 */
export function parseDragFunction(text) {
  const lines = String(text || '').split(/\r?\n/);
  const points = [];
  let skipped = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^[#;/]/.test(line)) continue;

    // Is a comma the decimal mark here, or the separator?
    //
    // Decided by what else is on the line rather than by pattern-matching the
    // comma itself. A period anywhere means the period is the decimal mark, so
    // the comma separates. Otherwise, if some other separator is present, the
    // comma is decimal. The first version tested whether a comma sat between
    // digits, which is true of "0.00,0.118" as well, and rewrote every
    // comma-separated file into a single unparseable token.
    const hasPeriod = line.includes('.');
    const hasOtherSep = /[;\t]/.test(line) || /\d\s+\d/.test(line);
    const commaIsDecimal = !hasPeriod && hasOtherSep;
    const normalised = commaIsDecimal ? line.replace(/(\d),(\d)/g, '$1.$2') : line;

    const nums = normalised.split(/[\s,;\t]+/).map(Number).filter(n => isFinite(n));
    if (nums.length < 2) { if (/[a-z]/i.test(line)) continue; skipped++; continue; }

    const [mach, cd] = nums;
    // A drag curve lives in a known box. Mach 0 to about 6, Cd positive and
    // below 1.5 for any real projectile. Outside that it is not this kind of
    // data and should not be silently accepted.
    if (mach < 0 || mach > 6 || cd <= 0 || cd > 1.5) { skipped++; continue; }
    points.push([mach, cd]);
  }

  if (points.length < 8) {
    return {
      ok: false,
      reason: `Only ${points.length} usable point${points.length === 1 ? '' : 's'} found. A drag curve needs at least eight, and this does not look like one.`,
      points: [],
    };
  }

  points.sort((a, b) => a[0] - b[0]);

  // Duplicated Mach values would make interpolation ambiguous.
  const clean = [];
  for (const p of points) {
    if (clean.length && Math.abs(p[0] - clean[clean.length - 1][0]) < 1e-9) continue;
    clean.push(p);
  }

  const machs = clean.map(p => p[0]);
  return {
    ok: true,
    points: clean,
    skipped,
    machMin: machs[0],
    machMax: machs[machs.length - 1],
    // Whether it actually covers the region that matters. A curve that stops at
    // Mach 1 is useless for the part of the trajectory a shooter cares about.
    coversTransonic: machs[0] <= 0.9 && machs[machs.length - 1] >= 1.2,
  };
}

/**
 * Does this curve look like it will behave?
 *
 * Not a judgement about the bullet, a check that the file is a drag curve and
 * not something else that happened to parse.
 */
export function checkDragFunction(parsed) {
  if (!parsed?.ok) return { ok: false, level: 'bad', text: parsed?.reason || 'Not a drag curve.' };

  if (!parsed.coversTransonic) {
    return {
      ok: false, level: 'range',
      text: `This curve only covers Mach ${parsed.machMin.toFixed(2)} to ${parsed.machMax.toFixed(2)}. Transonic is where a custom curve earns its keep, so it needs to span at least Mach 0.9 to 1.2.`,
    };
  }

  // Every real projectile's drag rises through transonic. A curve that does not
  // is either not drag data or is the wrong way round.
  const at = (m) => interpolateCd(parsed.points, m);
  if (at(1.1) <= at(0.8)) {
    return {
      ok: false, level: 'shape',
      text: 'Drag does not rise through transonic in this data, which no real projectile does. Check the columns are Mach first, then Cd.',
    };
  }

  return {
    ok: true, level: 'good',
    text: `${parsed.points.length} points from Mach ${parsed.machMin.toFixed(2)} to ${parsed.machMax.toFixed(2)}${parsed.skipped ? `, ${parsed.skipped} line${parsed.skipped === 1 ? '' : 's'} ignored` : ''}.`,
  };
}

/** Linear interpolation, clamped, matching how the standard tables are read. */
export function interpolateCd(points, mach) {
  if (!points?.length) return null;
  if (mach <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (mach >= last[0]) return last[1];
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= mach) lo = mid; else hi = mid;
  }
  const [m0, c0] = points[lo], [m1, c1] = points[hi];
  return c0 + ((mach - m0) / (m1 - m0)) * (c1 - c0);
}

/**
 * A stored curve, with where it came from attached.
 *
 * `source` is required. The app will not hold a drag curve it cannot account
 * for: it is the difference between data that can be shipped and data that
 * cannot, and it is not recoverable later by looking at the numbers.
 */
export function makeDragFunction({ name, source, points, note = '' }) {
  const n = String(name || '').trim();
  const src = String(source || '').trim();
  if (!n || !src || !points?.length) return null;
  return {
    id: 'df' + Date.now() + Math.random().toString(36).slice(2, 6),
    name: n,
    source: src,
    note: String(note || '').trim(),
    points,
    addedAt: new Date().toISOString(),
  };
}

/**
 * How much a custom curve differs from the standard one it replaces.
 *
 * Shown so importing a curve is a decision rather than an act of faith. If the
 * difference is negligible the shooter has learned something; if it is large,
 * they know where.
 */
export function compareToStandard(points, standardCd, model = 'G7', bc = 1) {
  const out = [];
  for (const mach of [0.8, 0.9, 1.0, 1.05, 1.2, 1.5, 2.0, 2.5]) {
    const custom = interpolateCd(points, mach);
    const std = standardCd(model, mach) / bc;
    if (custom == null || !isFinite(std) || std <= 0) continue;
    out.push({ mach, custom, standard: std, ratio: custom / std });
  }
  if (!out.length) return null;
  const worst = out.reduce((a, b) => (Math.abs(b.ratio - 1) > Math.abs(a.ratio - 1) ? b : a));
  return { rows: out, worst };
}
