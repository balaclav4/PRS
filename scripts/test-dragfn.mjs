/**
 * Validates importing a measured drag curve.
 *
 * The thing that matters is refusal. A half-parsed curve is worse than a
 * rejected one, because it will solve and it will be wrong, and nothing
 * downstream can tell. So most of this feeds the parser things that are not
 * drag curves and checks it says so.
 *
 * Run: node scripts/test-dragfn.mjs
 */
import {
  parseDragFunction, checkDragFunction, interpolateCd,
  makeDragFunction, compareToStandard,
} from '../lib/dragfn.js';
import { standardCd } from '../lib/ballistics.js';

let fails = 0;
const check = (name, ok, detail = '') => {
  if (!ok) fails++;
  console.log((ok ? '✓ ' : '✗ ') + name.padEnd(56) + detail);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/** A plausible measured curve: flat subsonic, rising through transonic. */
const CURVE = [
  [0.00, 0.118], [0.40, 0.117], [0.70, 0.119], [0.80, 0.123], [0.85, 0.130],
  [0.90, 0.146], [0.95, 0.205], [1.00, 0.379], [1.05, 0.402], [1.20, 0.387],
  [1.50, 0.343], [2.00, 0.297], [2.50, 0.269], [3.00, 0.242],
];
const asCsv = (rows, sep = ',') => rows.map(r => r.join(sep)).join('\n');

console.log('reading a file');
{
  const p = parseDragFunction(asCsv(CURVE));
  check('  comma separated', p.ok && p.points.length === 14, `${p.points.length} points`);
  check('  tab separated', parseDragFunction(asCsv(CURVE, '\t')).ok);
  check('  space separated', parseDragFunction(asCsv(CURVE, ' ')).ok);
  check('  semicolon separated', parseDragFunction(asCsv(CURVE, ';')).ok);

  check('  a header row is skipped',
    parseDragFunction('Mach,Cd\n' + asCsv(CURVE)).points.length === 14);
  check('  comments are skipped',
    parseDragFunction('# Lapua GB528\n; notes\n' + asCsv(CURVE)).points.length === 14);

  // European files write 0,118 rather than 0.118.
  const euro = CURVE.map(([m, c]) => `${String(m).replace('.', ',')};${String(c).replace('.', ',')}`).join('\n');
  const pe = parseDragFunction(euro);
  check('  a decimal comma is understood', pe.ok && near(pe.points[0][1], 0.118, 1e-9),
    pe.ok ? `first Cd ${pe.points[0][1]}` : pe.reason);

  check('  points come back sorted', (() => {
    const shuffled = [...CURVE].reverse();
    const q = parseDragFunction(asCsv(shuffled));
    return q.points.every((pt, i) => i === 0 || pt[0] > q.points[i - 1][0]);
  })());
  check('  duplicate Mach values are collapsed',
    parseDragFunction(asCsv([...CURVE, [1.00, 0.380]])).points.length === 14,
    'two Cd values at one Mach would make interpolation ambiguous');
}

console.log('\nrefusing what is not a drag curve');
{
  check('  empty input', !parseDragFunction('').ok);
  check('  prose', !parseDragFunction('the quick brown fox\njumped over').ok);
  check('  too few points', !parseDragFunction('0.5,0.12\n1.0,0.38').ok);
  check('  and says how many it found',
    /Only 2 usable points/.test(parseDragFunction('0.5,0.12\n1.0,0.38').reason));

  // Numbers, but not this kind of data.
  const velocities = Array.from({ length: 20 }, (_, i) => `${2800 - i * 50},${1.2 + i * 0.1}`).join('\n');
  check('  a velocity table is not a drag curve', !parseDragFunction(velocities).ok,
    'Mach 2800 is outside anything real');

  const q = parseDragFunction(asCsv(CURVE.map(([m, c]) => [c, m])));
  check('  columns the wrong way round are caught by the shape check',
    !checkDragFunction(q).ok, checkDragFunction(q).level);
}

console.log('\nchecking the shape');
{
  const good = checkDragFunction(parseDragFunction(asCsv(CURVE)));
  check('  a real curve passes', good.ok && good.level === 'good', good.text);

  // Long enough to parse, so it reaches the coverage check rather than being
  // rejected for being too short. The first version filtered CURVE down to six
  // points and was refused one step earlier, for a different reason.
  const subsonicOnly = [];
  for (let m = 0; m <= 0.9; m += 0.05) subsonicOnly.push([+m.toFixed(2), 0.118 + m * 0.01]);
  const short = parseDragFunction(asCsv(subsonicOnly));
  const sc = checkDragFunction(short);
  check('  one that stops before transonic is refused', !sc.ok && sc.level === 'range');
  check('  and says why that matters', /transonic is where a custom curve earns/i.test(sc.text));

  // Falling through transonic is not a thing any projectile does.
  const backwards = CURVE.map(([m, c]) => [m, 0.5 - c * 0.5]);
  const bc = checkDragFunction(parseDragFunction(asCsv(backwards)));
  check('  drag that falls through transonic is refused', !bc.ok && bc.level === 'shape');
  check('  and suggests the likely cause', /columns are Mach first/.test(bc.text));
}

console.log('\ninterpolation');
{
  const pts = parseDragFunction(asCsv(CURVE)).points;
  check('  hits a tabulated point exactly', near(interpolateCd(pts, 1.05), 0.402, 1e-9));
  check('  interpolates between two', near(interpolateCd(pts, 1.025), (0.379 + 0.402) / 2, 1e-9));
  check('  clamps below the table', interpolateCd(pts, -1) === 0.118);
  check('  and above it', interpolateCd(pts, 99) === 0.242);
  check('  nothing in, nothing out', interpolateCd([], 1) === null);
}

console.log('\nprovenance is not optional');
{
  const pts = parseDragFunction(asCsv(CURVE)).points;
  check('  a curve without a source is refused',
    makeDragFunction({ name: 'GB528', points: pts }) === null,
    'six months on, nobody can tell where an unattributed curve came from');
  check('  or without a name', makeDragFunction({ source: 'Lapua', points: pts }) === null);
  check('  or without points', makeDragFunction({ name: 'x', source: 'y', points: [] }) === null);

  const df = makeDragFunction({ name: 'GB528', source: 'Lapua radar data', points: pts });
  check('  a complete one is kept, with when it arrived',
    df.name === 'GB528' && df.source === 'Lapua radar data' && !!df.addedAt);
  check('  and gets an id', !!df.id);
}

console.log('\nagainst the standard curve it replaces');
{
  const pts = parseDragFunction(asCsv(CURVE)).points;
  const cmp = compareToStandard(pts, standardCd, 'G7', 1);
  check('  compares at the Mach numbers that matter', cmp.rows.length >= 6);
  check('  and names where they diverge most',
    !!cmp.worst && cmp.worst.mach > 0, `worst at Mach ${cmp.worst.mach}, ratio ${cmp.worst.ratio.toFixed(2)}`);

  // A curve identical to G7 scaled by its BC should compare as ~1 everywhere.
  const g7 = [];
  for (let m = 0; m <= 3; m += 0.05) g7.push([+m.toFixed(2), standardCd('G7', m) / 0.315]);
  const same = compareToStandard(g7, standardCd, 'G7', 0.315);
  check('  a curve equal to the standard reads as no change',
    same.rows.every(r => near(r.ratio, 1, 0.02)),
    `worst deviation ${(Math.abs(same.worst.ratio - 1) * 100).toFixed(1)}%`);
}

console.log('\n' + (fails === 0 ? 'all checks passed' : `${fails} check(s) failed`));
process.exit(fails === 0 ? 0 : 1);
