import { Platform } from 'react-native';

/**
 * Local persistence.
 *
 * Native uses expo-sqlite. Web uses localStorage instead: expo-sqlite's web
 * backend is alpha and requires SharedArrayBuffer, which means serving the app
 * with Cross-Origin-Embedder-Policy / Cross-Origin-Opener-Policy headers plus a
 * WASM Metro config. Not worth that for a local-first dataset this small.
 *
 * Shots are stored as JSON on the target row — they are never queried
 * independently of their target.
 */

const WEB_KEY = 'prs.db.v1';
const isWeb = Platform.OS === 'web';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS rifles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT, cartridge TEXT, barrelLength TEXT, twist TEXT, notes TEXT,
  -- Rounds fired before the app existed. Without it a round count only knows
  -- about photographed groups and reads a fraction of the truth, which would
  -- make every barrel-life threshold meaningless.
  priorRounds INTEGER, barrelInstalledAt TEXT
);
CREATE TABLE IF NOT EXISTS loads (
  id TEXT PRIMARY KEY NOT NULL,
  rifleId TEXT, bullet TEXT, powder TEXT, chargeGr REAL, primer TEXT,
  brass TEXT, coalOrCbto REAL, velocityFps REAL, name TEXT, caliber TEXT, sd REAL,
  -- Components vary batch to batch; a lot number is what makes a velocity
  -- shift attributable rather than mysterious.
  powderLot TEXT, primerLot TEXT, bulletLot TEXT, brassLot TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT, date TEXT, rifleId TEXT, loadId TEXT, distanceYd REAL,
  suppressed INTEGER, notes TEXT, best TEXT, meanRadius TEXT,
  sd REAL, mv REAL, targetCount INTEGER,
  velocitiesJson TEXT, velocityEs REAL
);
-- A target records where the shots landed, not what they landed on. The photo
-- is a measuring instrument: it gets normalised, displayed, detected on and
-- marked, and then only the coordinates and the scale corners are worth
-- keeping. Nothing in the app ever read the photo back.
--
-- Installs from before this keep a vestigial photoUri column holding a dangling
-- cache path. Left in place deliberately rather than dropped: ALTER TABLE DROP
-- COLUMN is a comparatively recent SQLite addition and can fail outright, which
-- would break startup, whereas an unwritten NULL column costs nothing.
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY NOT NULL,
  sessionId TEXT NOT NULL, ordinal INTEGER,
  scaleJson TEXT, shotsJson TEXT
);
CREATE INDEX IF NOT EXISTS idx_targets_session ON targets(sessionId);
CREATE TABLE IF NOT EXISTS prefs (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
CREATE TABLE IF NOT EXISTS dopecards (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT, loadId TEXT, rifleId TEXT,
  createdAt TEXT, optsJson TEXT, rowsJson TEXT
);
CREATE TABLE IF NOT EXISTS loaddev (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT, rifleId TEXT, loadId TEXT,
  goalMoa REAL, hitRatePct REAL, testDistanceYd REAL,
  shotsPerCharge INTEGER, currentStep INTEGER,
  rungsJson TEXT, createdAt TEXT,
  seatingJson TEXT, seatingShots INTEGER,
  refShots INTEGER, refHits INTEGER, refGroupMoa REAL,
  refGroupShots INTEGER, refTargetIn REAL,
  primerJson TEXT, workupJson TEXT, bookMaxGr REAL,
  screenJson TEXT, screenShots INTEGER,
  coarseJson TEXT, coarseShots INTEGER
);
`;

let db = null;

/**
 * Columns added after the first release. CREATE TABLE IF NOT EXISTS is a no-op
 * on an existing database, so new columns need an explicit ALTER; SQLite has no
 * IF NOT EXISTS for that, hence the check against the live column list.
 */
const MIGRATIONS = [
  ['rifles', 'priorRounds', 'INTEGER'],
  ['rifles', 'barrelInstalledAt', 'TEXT'],
  ['loads', 'powderLot', 'TEXT'],
  ['loads', 'primerLot', 'TEXT'],
  ['loads', 'bulletLot', 'TEXT'],
  ['loads', 'brassLot', 'TEXT'],
  ['sessions', 'velocitiesJson', 'TEXT'],
  ['sessions', 'velocityEs', 'REAL'],
  ['loaddev', 'seatingJson', 'TEXT'],
  ['loaddev', 'seatingShots', 'INTEGER'],
  ['loaddev', 'refShots', 'INTEGER'],
  ['loaddev', 'refHits', 'INTEGER'],
  ['loaddev', 'refGroupMoa', 'REAL'],
  ['loaddev', 'refGroupShots', 'INTEGER'],
  ['loaddev', 'refTargetIn', 'REAL'],
  ['loaddev', 'primerJson', 'TEXT'],
  ['loaddev', 'workupJson', 'TEXT'],
  ['loaddev', 'bookMaxGr', 'REAL'],
  ['loaddev', 'screenJson', 'TEXT'],
  ['loaddev', 'screenShots', 'INTEGER'],
  ['loaddev', 'coarseJson', 'TEXT'],
  ['loaddev', 'coarseShots', 'INTEGER'],
];

async function migrate(d) {
  for (const [table, column, type] of MIGRATIONS) {
    const cols = await d.getAllAsync(`PRAGMA table_info(${table})`);
    if (!cols.some(c => c.name === column)) {
      await d.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
}

async function open() {
  if (db) return db;
  const SQLite = require('expo-sqlite');
  db = await SQLite.openDatabaseAsync('prs.db');
  await db.execAsync(SCHEMA);
  await migrate(db);
  return db;
}

// ---------- web (localStorage) ----------

function webRead() {
  try {
    const raw = localStorage.getItem(WEB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function webWrite(data) {
  try {
    localStorage.setItem(WEB_KEY, JSON.stringify(data));
  } catch {
    // Quota or private-mode failure — the in-memory state stays authoritative.
  }
}

function webMutate(fn) {
  const data = webRead() || { rifles: [], loads: [], sessions: [] };
  fn(data);
  webWrite(data);
}

function upsertInto(arr, row) {
  const i = arr.findIndex(x => x.id === row.id);
  if (i >= 0) arr[i] = { ...arr[i], ...row };
  else arr.push(row);
}

// ---------- public API ----------

/**
 * Opens storage and seeds it on first run.
 * Returns the full dataset, or null if storage is unavailable.
 */
/**
 * Seeding is gated on a `seeded` pref, not on the tables being empty.
 *
 * Counting rows looked equivalent and is not: after the user erases their data
 * every table is empty again, so the next launch helpfully restored the whole
 * demo dataset and made "delete everything" look like it had failed. The flag
 * records that seeding has already happened once, and erasing sets it too.
 *
 * Existing installs have data but no flag, and the row count still guards them,
 * so they are not re-seeded either.
 */
export async function initDb(seed) {
  try {
    if (isWeb) {
      const existing = webRead();
      if (!existing) {
        webWrite({ ...seed, prefs: { ...(seed.prefs || {}), seeded: true } });
      } else if (!existing.projects || !existing.dopeCards || !existing.prefs) {
        // Storage written before a later feature existed: backfill the missing
        // keys rather than discarding the user's sessions by re-seeding.
        webWrite({
          ...existing,
          projects: existing.projects || seed.projects || [],
          dopeCards: existing.dopeCards || [],
          prefs: existing.prefs || {},
        });
      }
      return webRead();
    }

    const d = await open();
    const flag = await d.getFirstAsync("SELECT value FROM prefs WHERE key = 'seeded'");
    const alreadySeeded = !!flag;
    const { n } = await d.getFirstAsync('SELECT COUNT(*) AS n FROM rifles');
    if (!alreadySeeded && n === 0) {
      await seedNative(d, seed);
      const { np } = await d.getFirstAsync('SELECT COUNT(*) AS np FROM loaddev');
      if (np === 0) for (const p of seed.projects || []) await putProject(p);
      await putPref('seeded', true);
    }
    return await readAll();
  } catch (e) {
    console.warn('[db] init failed, running in-memory only:', e.message);
    return null;
  }
}

async function seedNative(d, seed) {
  for (const r of seed.rifles) await putRifle(r);
  for (const l of seed.loads) await putLoad(l);
  for (const s of seed.sessions) await putSession(s);
}

export async function readAll() {
  if (isWeb) {
    const d = webRead() || {};
    return {
      rifles: d.rifles || [], loads: d.loads || [], sessions: d.sessions || [],
      projects: d.projects || [], dopeCards: d.dopeCards || [], prefs: d.prefs || {},
    };
  }

  const d = await open();
  const rifles = await d.getAllAsync('SELECT * FROM rifles');
  const loads = await d.getAllAsync('SELECT * FROM loads');
  const sessionRows = await d.getAllAsync('SELECT * FROM sessions');
  const targetRows = await d.getAllAsync('SELECT * FROM targets ORDER BY ordinal');
  const projectRows = await d.getAllAsync('SELECT * FROM loaddev');
  const dopeRows = await d.getAllAsync('SELECT * FROM dopecards');
  const prefRows = await d.getAllAsync('SELECT * FROM prefs');

  const bySession = new Map();
  for (const t of targetRows) {
    const target = {
      id: t.id,
      scale: t.scaleJson ? JSON.parse(t.scaleJson) : null,
      shots: t.shotsJson ? JSON.parse(t.shotsJson) : [],
    };
    bySession.set(t.sessionId, (bySession.get(t.sessionId) || []).concat(target));
  }

  const sessions = sessionRows.map(s => ({
    ...s,
    suppressed: !!s.suppressed,
    velocities: s.velocitiesJson ? JSON.parse(s.velocitiesJson) : [],
    targets: bySession.get(s.id) || [],
  }));

  const projects = projectRows.map(p => ({
    ...p,
    rungs: p.rungsJson ? JSON.parse(p.rungsJson) : [],
    seatingRows: p.seatingJson ? JSON.parse(p.seatingJson) : [],
    primerRows: p.primerJson ? JSON.parse(p.primerJson) : [],
    workupRows: p.workupJson ? JSON.parse(p.workupJson) : [],
    screenRows: p.screenJson ? JSON.parse(p.screenJson) : [],
    coarseRows: p.coarseJson ? JSON.parse(p.coarseJson) : [],
  }));

  const dopeCards = dopeRows.map(c => ({
    ...c,
    opts: c.optsJson ? JSON.parse(c.optsJson) : {},
    rows: c.rowsJson ? JSON.parse(c.rowsJson) : [],
  }));

  const prefs = {};
  for (const r of prefRows) {
    try { prefs[r.key] = JSON.parse(r.value); } catch { prefs[r.key] = r.value; }
  }

  return { rifles, loads, sessions, projects, dopeCards, prefs };
}

export async function putRifle(r) {
  if (isWeb) return webMutate(d => upsertInto(d.rifles, r));
  const d = await open();
  await d.runAsync(
    `INSERT INTO rifles (id, name, cartridge, barrelLength, twist, notes,
                         priorRounds, barrelInstalledAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, cartridge=excluded.cartridge,
       barrelLength=excluded.barrelLength, twist=excluded.twist, notes=excluded.notes,
       priorRounds=excluded.priorRounds, barrelInstalledAt=excluded.barrelInstalledAt`,
    r.id, r.name ?? '', r.cartridge ?? '', r.barrelLength ?? '', r.twist ?? '', r.notes ?? '',
    r.priorRounds ?? 0, r.barrelInstalledAt ?? null
  );
}

export async function removeRifle(id) {
  if (isWeb) return webMutate(d => { d.rifles = d.rifles.filter(r => r.id !== id); });
  const d = await open();
  await d.runAsync('DELETE FROM rifles WHERE id = ?', id);
}

export async function putLoad(l) {
  if (isWeb) return webMutate(d => upsertInto(d.loads, l));
  const d = await open();
  await d.runAsync(
    `INSERT INTO loads (id, rifleId, bullet, powder, chargeGr, primer, brass,
                        coalOrCbto, velocityFps, name, caliber, sd,
                        powderLot, primerLot, bulletLot, brassLot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       rifleId=excluded.rifleId, bullet=excluded.bullet, powder=excluded.powder,
       chargeGr=excluded.chargeGr, primer=excluded.primer, brass=excluded.brass,
       coalOrCbto=excluded.coalOrCbto, velocityFps=excluded.velocityFps,
       name=excluded.name, caliber=excluded.caliber, sd=excluded.sd,
       powderLot=excluded.powderLot, primerLot=excluded.primerLot,
       bulletLot=excluded.bulletLot, brassLot=excluded.brassLot`,
    l.id, l.rifleId ?? null, l.bullet ?? '', l.powder ?? '', l.chargeGr ?? 0,
    l.primer ?? '', l.brass ?? '', l.coalOrCbto ?? 0, l.velocityFps ?? 0,
    l.name ?? '', l.caliber ?? '', l.sd ?? 0,
    l.powderLot ?? '', l.primerLot ?? '', l.bulletLot ?? '', l.brassLot ?? ''
  );
}

export async function removeLoad(id) {
  if (isWeb) return webMutate(d => { d.loads = d.loads.filter(l => l.id !== id); });
  const d = await open();
  await d.runAsync('DELETE FROM loads WHERE id = ?', id);
}

export async function putSession(s) {
  if (isWeb) return webMutate(d => upsertInto(d.sessions, s));
  const d = await open();
  await d.runAsync(
    `INSERT INTO sessions (id, name, date, rifleId, loadId, distanceYd, suppressed,
                           notes, best, meanRadius, sd, mv, targetCount,
                           velocitiesJson, velocityEs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, date=excluded.date, rifleId=excluded.rifleId,
       loadId=excluded.loadId, distanceYd=excluded.distanceYd,
       suppressed=excluded.suppressed, notes=excluded.notes, best=excluded.best,
       meanRadius=excluded.meanRadius, sd=excluded.sd, mv=excluded.mv,
       targetCount=excluded.targetCount, velocitiesJson=excluded.velocitiesJson,
       velocityEs=excluded.velocityEs`,
    s.id, s.name ?? '', s.date ?? '', s.rifleId ?? null, s.loadId ?? null,
    s.distanceYd ?? 0, s.suppressed ? 1 : 0, s.notes ?? '', String(s.best ?? ''),
    String(s.meanRadius ?? ''), s.sd ?? 0, s.mv ?? 0, s.targetCount ?? 0,
    s.velocities?.length ? JSON.stringify(s.velocities) : null, s.velocityEs ?? null
  );

  // Targets are owned by the session — replace them wholesale.
  await d.runAsync('DELETE FROM targets WHERE sessionId = ?', s.id);
  const targets = s.targets || [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    await d.runAsync(
      `INSERT INTO targets (id, sessionId, ordinal, scaleJson, shotsJson)
       VALUES (?, ?, ?, ?, ?)`,
      t.id, s.id, i,
      t.scale ? JSON.stringify(t.scale) : null,
      JSON.stringify(t.shots || [])
    );
  }
}

export async function removeSession(id) {
  if (isWeb) return webMutate(d => { d.sessions = d.sessions.filter(s => s.id !== id); });
  const d = await open();
  await d.runAsync('DELETE FROM targets WHERE sessionId = ?', id);
  await d.runAsync('DELETE FROM sessions WHERE id = ?', id);
}

export async function putProject(p) {
  if (isWeb) return webMutate(d => {
    d.projects = d.projects || [];
    upsertInto(d.projects, p);
  });
  const d = await open();
  await d.runAsync(
    `INSERT INTO loaddev (id, name, rifleId, loadId, goalMoa, hitRatePct,
                          testDistanceYd, shotsPerCharge, currentStep, rungsJson, createdAt,
                          seatingJson, seatingShots,
                          refShots, refHits, refGroupMoa, refGroupShots, refTargetIn,
                          primerJson, workupJson, bookMaxGr,
                          screenJson, screenShots, coarseJson, coarseShots)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, rifleId=excluded.rifleId, loadId=excluded.loadId,
       goalMoa=excluded.goalMoa, hitRatePct=excluded.hitRatePct,
       testDistanceYd=excluded.testDistanceYd, shotsPerCharge=excluded.shotsPerCharge,
       currentStep=excluded.currentStep, rungsJson=excluded.rungsJson,
       seatingJson=excluded.seatingJson, seatingShots=excluded.seatingShots,
       refShots=excluded.refShots, refHits=excluded.refHits,
       refGroupMoa=excluded.refGroupMoa, refGroupShots=excluded.refGroupShots,
       refTargetIn=excluded.refTargetIn, primerJson=excluded.primerJson,
       workupJson=excluded.workupJson, bookMaxGr=excluded.bookMaxGr,
       screenJson=excluded.screenJson, screenShots=excluded.screenShots,
       coarseJson=excluded.coarseJson, coarseShots=excluded.coarseShots`,
    p.id, p.name ?? '', p.rifleId ?? null, p.loadId ?? null,
    p.goalMoa ?? 0, p.hitRatePct ?? 0, p.testDistanceYd ?? 0,
    p.shotsPerCharge ?? 1, p.currentStep ?? 1,
    JSON.stringify(p.rungs || []), p.createdAt ?? new Date().toISOString(),
    JSON.stringify(p.seatingRows || []), p.seatingShots ?? 5,
    p.refShots ?? null, p.refHits ?? null, p.refGroupMoa ?? null,
    p.refGroupShots ?? null, p.refTargetIn ?? null,
    JSON.stringify(p.primerRows || []),
    JSON.stringify(p.workupRows || []), p.bookMaxGr ?? null,
    JSON.stringify(p.screenRows || []), p.screenShots ?? 5,
    JSON.stringify(p.coarseRows || []), p.coarseShots ?? 5
  );
}

export async function removeProject(id) {
  if (isWeb) return webMutate(d => { d.projects = (d.projects || []).filter(p => p.id !== id); });
  const d = await open();
  await d.runAsync('DELETE FROM loaddev WHERE id = ?', id);
}

export async function putDopeCard(c) {
  if (isWeb) return webMutate(d => {
    d.dopeCards = d.dopeCards || [];
    upsertInto(d.dopeCards, c);
  });
  const d = await open();
  await d.runAsync(
    `INSERT INTO dopecards (id, name, loadId, rifleId, createdAt, optsJson, rowsJson)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, loadId=excluded.loadId, rifleId=excluded.rifleId,
       optsJson=excluded.optsJson, rowsJson=excluded.rowsJson`,
    c.id, c.name ?? '', c.loadId ?? null, c.rifleId ?? null,
    c.createdAt ?? new Date().toISOString(),
    JSON.stringify(c.opts || {}), JSON.stringify(c.rows || [])
  );
}

export async function putPref(key, value) {
  if (isWeb) return webMutate(d => { d.prefs = { ...(d.prefs || {}), [key]: value }; });
  const d = await open();
  await d.runAsync(
    `INSERT INTO prefs (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    key, JSON.stringify(value)
  );
}

/**
 * Erase everything the user recorded, keeping their preferences.
 *
 * Sets the seeded flag so the demo data does not reappear on next launch.
 */
export async function clearUserData() {
  if (isWeb) {
    return webMutate(d => {
      d.rifles = []; d.loads = []; d.sessions = [];
      d.projects = []; d.dopeCards = [];
      d.prefs = { ...(d.prefs || {}), seeded: true };
    });
  }
  const d = await open();
  for (const t of ['targets', 'sessions', 'loaddev', 'dopecards', 'loads', 'rifles']) {
    await d.runAsync(`DELETE FROM ${t}`);
  }
  await putPref('seeded', true);
}

/** Erase everything including preferences. */
export async function clearEverything() {
  if (isWeb) {
    return webMutate(d => {
      d.rifles = []; d.loads = []; d.sessions = [];
      d.projects = []; d.dopeCards = [];
      d.prefs = { seeded: true };
    });
  }
  const d = await open();
  for (const t of ['targets', 'sessions', 'loaddev', 'dopecards', 'loads', 'rifles', 'prefs']) {
    await d.runAsync(`DELETE FROM ${t}`);
  }
  await putPref('seeded', true);
}

export async function removeDopeCard(id) {
  if (isWeb) return webMutate(d => { d.dopeCards = (d.dopeCards || []).filter(c => c.id !== id); });
  const d = await open();
  await d.runAsync('DELETE FROM dopecards WHERE id = ?', id);
}
