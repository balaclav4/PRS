import { twoSampleTTest } from './math';

// Extreme spread of a target's shots, in normalized image units.
function esNorm(shots) {
  let max = 0;
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const d = Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y);
      if (d > max) max = d;
    }
  }
  return max;
}

function centroid(shots) {
  const cx = shots.reduce((a, s) => a + s.x, 0) / shots.length;
  const cy = shots.reduce((a, s) => a + s.y, 0) / shots.length;
  return { cx, cy };
}

export function moaFromInches(inches, distanceYd) {
  if (!distanceYd) return 0;
  return inches / (1.047 * (distanceYd / 100));
}

/**
 * Recover the session's inches-per-normalized-unit scale.
 *
 * Targets store shots in normalized image coords only, but the session records
 * `best` — the smallest target group, in inches. Since every target in a session
 * shares one photo scale, that pins the scale for all of them:
 *   inchesPerUnit = bestIn / min(esNorm over targets)
 */
function sessionScale(session) {
  const bestIn = parseFloat(session.best);
  if (!isFinite(bestIn) || !session.targets?.length) return null;

  const spreads = session.targets
    .filter(t => t.shots?.length >= 2)
    .map(t => esNorm(t.shots))
    .filter(v => v > 0);

  if (!spreads.length) return null;
  const minSpread = Math.min(...spreads);
  return bestIn / minSpread;
}

/** Per-target group sizes for a session, in inches and MOA. */
export function targetGroups(session) {
  const scale = sessionScale(session);
  if (!scale) return [];

  return session.targets
    .filter(t => t.shots?.length >= 2)
    .map(t => {
      const inches = esNorm(t.shots) * scale;
      return {
        id: t.id,
        shots: t.shots,
        inches,
        moa: moaFromInches(inches, session.distanceYd),
      };
    });
}

/** Shot offsets from the group centroid, expressed in MOA. */
export function shotsAsMoa(session, target) {
  const scale = sessionScale(session);
  if (!scale || !target?.shots?.length) return [];
  const { cx, cy } = centroid(target.shots);
  return target.shots.map(s => ({
    x: moaFromInches((s.x - cx) * scale, session.distanceYd),
    y: moaFromInches((s.y - cy) * scale, session.distanceYd),
  }));
}

function parseDate(d) {
  const t = Date.parse(d);
  return isFinite(t) ? t : 0;
}

/**
 * Derive every analytics figure from real session data.
 * `filter` is 'all' or a rifle name.
 */
export function deriveAnalytics(sessions, rifles, loads, filter = 'all') {
  const rifleByName = {};
  rifles.forEach(r => { rifleByName[r.name] = r.id; });

  const scoped = filter === 'all'
    ? sessions
    : sessions.filter(s => s.rifleId === rifleByName[filter]);

  const ordered = [...scoped].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  // Every target is one independent group.
  const groups = [];
  ordered.forEach(s => targetGroups(s).forEach(g => groups.push({ ...g, session: s })));

  const rounds = scoped.reduce(
    (a, s) => a + (s.targets?.reduce((b, t) => b + (t.shots?.length || 0), 0) || 0),
    0
  );

  const avg = groups.length
    ? groups.reduce((a, g) => a + g.moa, 0) / groups.length
    : null;

  // Trend: one point per session (its best group, in MOA), oldest → latest.
  const trend = ordered
    .map(s => {
      const g = targetGroups(s);
      return g.length ? Math.min(...g.map(x => x.moa)) : null;
    })
    .filter(v => v != null);

  // Shot distribution: the tightest group of the most recent session.
  const latestSession = ordered[ordered.length - 1];
  let moaShots = [];
  let latestShots = 0;
  let latestGroup = null;
  if (latestSession) {
    const g = targetGroups(latestSession);
    if (g.length) {
      const best = g.reduce((a, b) => (b.moa < a.moa ? b : a));
      moaShots = shotsAsMoa(latestSession, best);
      latestShots = best.shots.length;
      latestGroup = best.inches;
    }
  }

  return {
    avg,
    rounds,
    trend,
    moaShots,
    latestShots,
    latestGroup,
    sessionCount: scoped.length,
    comparison: compareLoads(scoped, loads),
  };
}

/**
 * Two-sample t-test between the two loads with the most recorded groups.
 * Returns null when there isn't enough data to say anything honest.
 */
export function compareLoads(sessions, loads) {
  const byLoad = new Map();
  sessions.forEach(s => {
    if (!s.loadId) return;
    const g = targetGroups(s).map(x => x.inches);
    if (!g.length) return;
    byLoad.set(s.loadId, (byLoad.get(s.loadId) || []).concat(g));
  });

  const ranked = [...byLoad.entries()]
    .filter(([, g]) => g.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  if (ranked.length < 2) {
    return { insufficient: true, needed: 'Two loads with 2+ recorded groups each' };
  }

  const nameOf = (id) => loads.find(l => l.id === id)?.name || 'Unknown load';
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  // Present the tighter load second so it reads as the winner.
  let [a, b] = ranked.slice(0, 2);
  if (mean(a[1]) < mean(b[1])) [a, b] = [b, a];

  const test = twoSampleTTest(a[1], b[1]);

  return {
    insufficient: false,
    a: { name: nameOf(a[0]), mean: mean(a[1]), n: a[1].length },
    b: { name: nameOf(b[0]), mean: mean(b[1]), n: b[1].length },
    test,
  };
}
