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
  name TEXT, cartridge TEXT, barrelLength TEXT, twist TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS loads (
  id TEXT PRIMARY KEY NOT NULL,
  rifleId TEXT, bullet TEXT, powder TEXT, chargeGr REAL, primer TEXT,
  brass TEXT, coalOrCbto REAL, velocityFps REAL, name TEXT, caliber TEXT, sd REAL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT, date TEXT, rifleId TEXT, loadId TEXT, distanceYd REAL,
  suppressed INTEGER, notes TEXT, best TEXT, meanRadius TEXT,
  sd REAL, mv REAL, targetCount INTEGER,
  velocitiesJson TEXT, velocityEs REAL
);
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY NOT NULL,
  sessionId TEXT NOT NULL, ordinal INTEGER,
  photoUri TEXT, scaleJson TEXT, shotsJson TEXT
);
CREATE INDEX IF NOT EXISTS idx_targets_session ON targets(sessionId);
CREATE TABLE IF NOT EXISTS loaddev (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT, rifleId TEXT, loadId TEXT,
  goalMoa REAL, hitRatePct REAL, testDistanceYd REAL,
  shotsPerCharge INTEGER, currentStep INTEGER,
  rungsJson TEXT, createdAt TEXT
);
`;

let db = null;

/**
 * Columns added after the first release. CREATE TABLE IF NOT EXISTS is a no-op
 * on an existing database, so new columns need an explicit ALTER; SQLite has no
 * IF NOT EXISTS for that, hence the check against the live column list.
 */
const MIGRATIONS = [
  ['sessions', 'velocitiesJson', 'TEXT'],
  ['sessions', 'velocityEs', 'REAL'],
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
export async function initDb(seed) {
  try {
    if (isWeb) {
      const existing = webRead();
      if (!existing) {
        webWrite(seed);
      } else if (!existing.projects) {
        // Storage written before load-dev existed: backfill rather than
        // discarding the user's sessions by re-seeding wholesale.
        webWrite({ ...existing, projects: seed.projects || [] });
      }
      return webRead();
    }

    const d = await open();
    const { n } = await d.getFirstAsync('SELECT COUNT(*) AS n FROM rifles');
    if (n === 0) await seedNative(d, seed);
    const { np } = await d.getFirstAsync('SELECT COUNT(*) AS np FROM loaddev');
    if (np === 0) for (const p of seed.projects || []) await putProject(p);
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
    return { rifles: d.rifles || [], loads: d.loads || [], sessions: d.sessions || [], projects: d.projects || [] };
  }

  const d = await open();
  const rifles = await d.getAllAsync('SELECT * FROM rifles');
  const loads = await d.getAllAsync('SELECT * FROM loads');
  const sessionRows = await d.getAllAsync('SELECT * FROM sessions');
  const targetRows = await d.getAllAsync('SELECT * FROM targets ORDER BY ordinal');
  const projectRows = await d.getAllAsync('SELECT * FROM loaddev');

  const bySession = new Map();
  for (const t of targetRows) {
    const target = {
      id: t.id,
      photoUri: t.photoUri || null,
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
  }));

  return { rifles, loads, sessions, projects };
}

export async function putRifle(r) {
  if (isWeb) return webMutate(d => upsertInto(d.rifles, r));
  const d = await open();
  await d.runAsync(
    `INSERT INTO rifles (id, name, cartridge, barrelLength, twist, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, cartridge=excluded.cartridge,
       barrelLength=excluded.barrelLength, twist=excluded.twist, notes=excluded.notes`,
    r.id, r.name ?? '', r.cartridge ?? '', r.barrelLength ?? '', r.twist ?? '', r.notes ?? ''
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
                        coalOrCbto, velocityFps, name, caliber, sd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       rifleId=excluded.rifleId, bullet=excluded.bullet, powder=excluded.powder,
       chargeGr=excluded.chargeGr, primer=excluded.primer, brass=excluded.brass,
       coalOrCbto=excluded.coalOrCbto, velocityFps=excluded.velocityFps,
       name=excluded.name, caliber=excluded.caliber, sd=excluded.sd`,
    l.id, l.rifleId ?? null, l.bullet ?? '', l.powder ?? '', l.chargeGr ?? 0,
    l.primer ?? '', l.brass ?? '', l.coalOrCbto ?? 0, l.velocityFps ?? 0,
    l.name ?? '', l.caliber ?? '', l.sd ?? 0
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
      `INSERT INTO targets (id, sessionId, ordinal, photoUri, scaleJson, shotsJson)
       VALUES (?, ?, ?, ?, ?, ?)`,
      t.id, s.id, i, t.photoUri ?? null,
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
                          testDistanceYd, shotsPerCharge, currentStep, rungsJson, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, rifleId=excluded.rifleId, loadId=excluded.loadId,
       goalMoa=excluded.goalMoa, hitRatePct=excluded.hitRatePct,
       testDistanceYd=excluded.testDistanceYd, shotsPerCharge=excluded.shotsPerCharge,
       currentStep=excluded.currentStep, rungsJson=excluded.rungsJson`,
    p.id, p.name ?? '', p.rifleId ?? null, p.loadId ?? null,
    p.goalMoa ?? 0, p.hitRatePct ?? 0, p.testDistanceYd ?? 0,
    p.shotsPerCharge ?? 1, p.currentStep ?? 1,
    JSON.stringify(p.rungs || []), p.createdAt ?? new Date().toISOString()
  );
}

export async function removeProject(id) {
  if (isWeb) return webMutate(d => { d.projects = (d.projects || []).filter(p => p.id !== id); });
  const d = await open();
  await d.runAsync('DELETE FROM loaddev WHERE id = ?', id);
}
