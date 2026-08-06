import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import * as db from '../lib/db';
import { DEFAULT_UNITS, groupUnitLabel, inchesToUnit } from '../lib/units';
import { noConsent, grantConsent, revokeConsent } from '../lib/consent';

const SEED_RIFLES = [
  { id: 'r1', name: 'Impact 737R', cartridge: '6.5 Creedmoor', barrelLength: '26"', twist: '1:8', notes: 'Bartlein barrel' },
  { id: 'r2', name: 'Tikka T3x TAC A1', cartridge: '.308 Win', barrelLength: '24"', twist: '1:11', notes: '' },
  { id: 'r3', name: 'AI AXSR', cartridge: '6mm Dasher', barrelLength: '27"', twist: '1:7.5', notes: 'Proof barrel' },
];

const SEED_LOADS = [
  { id: 'l1', rifleId: 'r1', bullet: '140 Hybrid', powder: 'H4350', chargeGr: 41.8, primer: 'Fed 210M', brass: 'Lapua', coalOrCbto: 2.825, velocityFps: 2820, name: '140 Hybrid / H4350', caliber: '6.5 CM', sd: 8.4 },
  { id: 'l2', rifleId: 'r3', bullet: '105 Hybrid', powder: 'Varget', chargeGr: 33.2, primer: 'CCI BR4', brass: 'Alpha', coalOrCbto: 2.550, velocityFps: 2915, name: '105 Hybrid / Varget', caliber: '6 Dasher', sd: 6.1 },
  { id: 'l3', rifleId: 'r2', bullet: '175 SMK', powder: 'Varget', chargeGr: 44.0, primer: 'CCI 200', brass: 'Hornady', coalOrCbto: 2.800, velocityFps: 2610, name: '175 SMK / Varget', caliber: '.308', sd: 11.2 },
];

const SEED_SESSIONS = [
  {
    id: 's1', date: 'Jul 18, 2026', rifleId: 'r1', loadId: 'l1', distanceYd: 100, suppressed: true,
    notes: '', name: 'Range Day — Steel Practice',
    targets: [
      { id: 't1', shots: [{ x: 0.48, y: 0.42 }, { x: 0.52, y: 0.46 }, { x: 0.50, y: 0.44 }, { x: 0.49, y: 0.47 }, { x: 0.51, y: 0.43 }] },
      { id: 't2', shots: [{ x: 0.47, y: 0.45 }, { x: 0.53, y: 0.43 }, { x: 0.50, y: 0.48 }, { x: 0.51, y: 0.42 }, { x: 0.49, y: 0.46 }] },
      { id: 't3', shots: [{ x: 0.48, y: 0.44 }, { x: 0.52, y: 0.47 }, { x: 0.50, y: 0.42 }, { x: 0.49, y: 0.46 }, { x: 0.51, y: 0.45 }] },
      { id: 't4', shots: [{ x: 0.49, y: 0.43 }, { x: 0.51, y: 0.47 }, { x: 0.50, y: 0.45 }, { x: 0.48, y: 0.46 }, { x: 0.52, y: 0.44 }] },
    ],
    best: '0.42', meanRadius: '0.14', sd: 8.4, mv: 2820, targetCount: 4,
  },
  {
    id: 's2', date: 'Jul 12, 2026', rifleId: 'r3', loadId: 'l2', distanceYd: 100, suppressed: true,
    notes: '', name: 'Load Verify — 6 Dasher',
    targets: [
      { id: 't5', shots: [{ x: 0.50, y: 0.45 }, { x: 0.51, y: 0.46 }, { x: 0.49, y: 0.44 }, { x: 0.50, y: 0.47 }, { x: 0.51, y: 0.45 }] },
      { id: 't6', shots: [{ x: 0.50, y: 0.44 }, { x: 0.49, y: 0.46 }, { x: 0.51, y: 0.45 }, { x: 0.50, y: 0.43 }, { x: 0.49, y: 0.45 }] },
      { id: 't7', shots: [{ x: 0.50, y: 0.45 }, { x: 0.51, y: 0.44 }, { x: 0.49, y: 0.46 }, { x: 0.50, y: 0.45 }, { x: 0.51, y: 0.44 }] },
    ],
    best: '0.28', meanRadius: '0.11', sd: 6.1, mv: 2915, targetCount: 3,
  },
  {
    id: 's3', date: 'Jul 5, 2026', rifleId: 'r2', loadId: 'l3', distanceYd: 200, suppressed: false,
    notes: '', name: '308 Cold Bore Check',
    targets: [
      { id: 't8', shots: [{ x: 0.46, y: 0.42 }, { x: 0.54, y: 0.48 }, { x: 0.50, y: 0.44 }, { x: 0.48, y: 0.50 }, { x: 0.52, y: 0.46 }] },
      { id: 't9', shots: [{ x: 0.47, y: 0.43 }, { x: 0.53, y: 0.47 }, { x: 0.50, y: 0.45 }, { x: 0.49, y: 0.49 }, { x: 0.51, y: 0.44 }] },
    ],
    best: '0.71', meanRadius: '0.32', sd: 11.2, mv: 2610, targetCount: 2,
  },
];

// One demo ladder so the screen isn't empty on first run. Unlike the old
// hardcoded table, the node and its confidence are computed from these rungs
// at render time — the conclusion is derived, not asserted.
const SEED_PROJECTS = [
  {
    id: 'p1',
    name: '6 Dasher — AXSR',
    rifleId: 'r3',
    loadId: 'l2',
    goalMoa: 0.5,
    hitRatePct: 90,
    testDistanceYd: 100,
    shotsPerCharge: 3,
    currentStep: 6,
    createdAt: '2026-07-01T00:00:00.000Z',
    rungs: [
      { id: 'g1', charge: '32.6', velocity: '2856', groupMoa: '0.52' },
      { id: 'g2', charge: '32.8', velocity: '2872', groupMoa: '0.44' },
      { id: 'g3', charge: '33.0', velocity: '2892', groupMoa: '0.34' },
      { id: 'g4', charge: '33.2', velocity: '2905', groupMoa: '0.29' },
      { id: 'g5', charge: '33.4', velocity: '2909', groupMoa: '0.31' },
      { id: 'g6', charge: '33.6', velocity: '2931', groupMoa: '0.44' },
      { id: 'g7', charge: '33.8', velocity: '2948', groupMoa: '0.52' },
    ],
  },
];

const DataContext = createContext();

const SEED = { rifles: SEED_RIFLES, loads: SEED_LOADS, sessions: SEED_SESSIONS, projects: SEED_PROJECTS };

export function DataProvider({ children }) {
  const [rifles, setRifles] = useState(SEED_RIFLES);
  const [loads, setLoads] = useState(SEED_LOADS);
  const [sessions, setSessions] = useState(SEED_SESSIONS);
  const [projects, setProjects] = useState(SEED_PROJECTS);
  const [dopeCards, setDopeCards] = useState([]);
  const [units, setUnits] = useState(DEFAULT_UNITS);
  // Backs the initials in the dashboard corner. Local label, not an identity —
  // there is no account behind it yet.
  const [profileName, setProfileName] = useState('');
  // Off until explicitly granted. Never inferred, never defaulted on.
  const [trainingConsent, setTrainingConsentState] = useState(noConsent());
  const [ready, setReady] = useState(false);

  // Hydrate from local storage on boot. If storage is unavailable we keep the
  // seed data in memory rather than showing an empty app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await db.initDb(SEED);
      if (!cancelled && data) {
        setRifles(data.rifles);
        setLoads(data.loads);
        setSessions(data.sessions);
        // Nullish, not falsy. Falling back on an *empty* array could not tell
        // "this install predates load dev" from "the user erased their data",
        // so the seed project reappeared on the dashboard immediately after an
        // erase — the one place it must not.
        setProjects(data.projects ?? SEED_PROJECTS);
        setDopeCards(data.dopeCards || []);
        // Stored prefs override defaults per key, so a partially-set prefs
        // object still yields a complete unit set.
        setUnits({ ...DEFAULT_UNITS, ...(data.prefs?.units || {}) });
        setProfileName(data.prefs?.profileName ?? '');
        setTrainingConsentState(data.prefs?.trainingConsent ?? noConsent());
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const getRifle = useCallback((id) => rifles.find(r => r.id === id), [rifles]);
  const getLoad = useCallback((id) => loads.find(l => l.id === id), [loads]);
  const getSession = useCallback((id) => sessions.find(s => s.id === id), [sessions]);

  const getRifleName = useCallback((id) => {
    const r = rifles.find(r => r.id === id);
    return r ? r.name : 'Unknown';
  }, [rifles]);

  // Writes go to React state first (so the UI is immediate) and are persisted
  // in the background; a storage failure never blocks the interaction.
  const persist = (fn) => { fn().catch(e => console.warn('[db] write failed:', e.message)); };

  const addSession = useCallback((session) => {
    setSessions(prev => [session, ...prev]);
    persist(() => db.putSession(session));
  }, []);

  const updateSession = useCallback((id, updates) => {
    setSessions(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updates } : s);
      const row = next.find(s => s.id === id);
      if (row) persist(() => db.putSession(row));
      return next;
    });
  }, []);

  const addRifle = useCallback((rifle) => {
    const row = { ...rifle, id: 'r' + Date.now() };
    setRifles(prev => [...prev, row]);
    persist(() => db.putRifle(row));
  }, []);

  const updateRifle = useCallback((id, updates) => {
    setRifles(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...updates } : r);
      const row = next.find(r => r.id === id);
      if (row) persist(() => db.putRifle(row));
      return next;
    });
  }, []);

  const deleteRifle = useCallback((id) => {
    setRifles(prev => prev.filter(r => r.id !== id));
    persist(() => db.removeRifle(id));
  }, []);

  const addLoad = useCallback((load) => {
    const row = { ...load, id: 'l' + Date.now() };
    setLoads(prev => [...prev, row]);
    persist(() => db.putLoad(row));
  }, []);

  const updateLoad = useCallback((id, updates) => {
    setLoads(prev => {
      const next = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      const row = next.find(l => l.id === id);
      if (row) persist(() => db.putLoad(row));
      return next;
    });
  }, []);

  const deleteLoad = useCallback((id) => {
    setLoads(prev => prev.filter(l => l.id !== id));
    persist(() => db.removeLoad(id));
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    persist(() => db.removeSession(id));
  }, []);

  const getProject = useCallback((id) => projects.find(p => p.id === id), [projects]);

  const addProject = useCallback((project) => {
    const row = { ...project, id: 'p' + Date.now(), createdAt: new Date().toISOString() };
    setProjects(prev => [...prev, row]);
    persist(() => db.putProject(row));
    return row;
  }, []);

  const updateProject = useCallback((id, updates) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      const row = next.find(p => p.id === id);
      if (row) persist(() => db.putProject(row));
      return next;
    });
  }, []);

  const deleteProject = useCallback((id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    persist(() => db.removeProject(id));
  }, []);

  /**
   * Erase everything the user recorded. In-memory state is cleared alongside
   * storage — clearing only the database would leave the screens showing data
   * that no longer exists until the app was relaunched.
   */
  const clearAllData = useCallback(() => {
    setSessions([]); setRifles([]); setLoads([]); setProjects([]); setDopeCards([]);
    persist(() => db.clearUserData());
  }, []);

  /**
   * The same, plus preferences. There is no server account to delete yet, so
   * this is the whole of what "delete account" can honestly do today.
   */
  const deleteAccount = useCallback(() => {
    setSessions([]); setRifles([]); setLoads([]); setProjects([]); setDopeCards([]);
    setUnits(DEFAULT_UNITS);
    setProfileName('');
    setTrainingConsentState(noConsent());
    persist(() => db.clearEverything());
  }, []);

  const setUnit = useCallback((kind, value) => {
    setUnits(prev => {
      const next = { ...prev, [kind]: value };
      persist(() => db.putPref('units', next));
      return next;
    });
  }, []);

  const setTrainingConsent = useCallback((on) => {
    setTrainingConsentState(prev => {
      const next = on ? grantConsent() : revokeConsent(prev);
      persist(() => db.putPref('trainingConsent', next));
      return next;
    });
  }, []);

  const setProfile = useCallback((name) => {
    setProfileName(name);
    persist(() => db.putPref('profileName', name));
  }, []);

  const getDopeCard = useCallback((id) => dopeCards.find(c => c.id === id), [dopeCards]);

  const addDopeCard = useCallback((card) => {
    const row = { ...card, id: 'd' + Date.now(), createdAt: new Date().toISOString() };
    setDopeCards(prev => [row, ...prev]);
    persist(() => db.putDopeCard(row));
    return row;
  }, []);

  const deleteDopeCard = useCallback((id) => {
    setDopeCards(prev => prev.filter(c => c.id !== id));
    persist(() => db.removeDopeCard(id));
  }, []);

  /**
   * CSV for every session, or just the ones whose ids are passed.
   * Values are quoted and embedded quotes doubled per RFC 4180 — a session
   * named `6.5 "hot" load` previously produced a malformed row.
   */
  const exportSessionsCSV = useCallback((ids = null) => {
    // Quotes are doubled and the value wrapped, which handles commas and
    // newlines. Leading =, +, - and @ need separate treatment: Excel and Sheets
    // read those as formulas, so a session named `=HYPERLINK(...)` becomes
    // executable content in the reader rather than text. Prefixing a tab keeps
    // the value visually identical and stops it being parsed as a formula.
    const cell = (v) => {
      let t = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(t)) t = '\t' + t;
      return `"${t.replace(/"/g, '""')}"`;
    };

    // Group sizes are stored in inches and velocities in fps; the export follows
    // the same unit preference as every screen, and the header says which.
    const gLabel = groupUnitLabel(units.group);
    const dLabel = units.distance;
    const vLabel = units.velocity;
    const grp = (inches, distanceYd) => {
      const v = inchesToUnit(parseFloat(inches), distanceYd, units.group);
      return v == null ? '' : v.toFixed(2);
    };
    const vel = (fps) => {
      const n = Number(fps);
      if (!isFinite(n) || n <= 0) return '';
      return units.velocity === 'm/s' ? (n * 0.3048).toFixed(0) : String(Math.round(n));
    };

    const header = [
      'Name', 'Date', 'Rifle', 'Load', `Distance (${dLabel})`, 'Suppressed',
      `Best Group (${gLabel})`, `Mean Radius (${gLabel})`,
      `MV (${vLabel})`, `SD (${vLabel})`, 'Targets', 'Total Shots',
    ].join(',');

    const scoped = ids ? sessions.filter(s => ids.includes(s.id)) : sessions;
    const rows = scoped.map(s => {
      const rifleName = rifles.find(r => r.id === s.rifleId)?.name || '';
      const loadName = loads.find(l => l.id === s.loadId)?.name || '';
      const totalShots = s.targets.reduce((a, t) => a + t.shots.length, 0);
      const dist = units.distance === 'm'
        ? Math.round(Number(s.distanceYd) * 0.9144)
        : s.distanceYd;
      return [
        s.name, s.date, rifleName, loadName, dist, s.suppressed ? 'Yes' : 'No',
        grp(s.best, s.distanceYd), grp(s.meanRadius, s.distanceYd),
        vel(s.mv), vel(s.sd), s.targetCount, totalShots,
      ].map(cell).join(',');
    });
    return header + '\n' + rows.join('\n');
  }, [sessions, rifles, loads, units]);

  const value = useMemo(() => ({
    rifles, loads, sessions, projects, dopeCards, units, setUnit, ready,
    profileName, setProfile, clearAllData, deleteAccount,
    trainingConsent, setTrainingConsent,
    getRifle, getLoad, getSession, getRifleName,
    addSession, updateSession, addRifle, addLoad,
    updateRifle, deleteRifle,
    updateLoad, deleteLoad,
    deleteSession,
    getProject, addProject, updateProject, deleteProject,
    getDopeCard, addDopeCard, deleteDopeCard,
    exportSessionsCSV,
  }), [rifles, loads, sessions, projects, dopeCards, units, setUnit, ready,
       profileName, setProfile, clearAllData, deleteAccount,
       trainingConsent, setTrainingConsent, getRifle, getLoad, getSession, getRifleName, addSession, updateSession, addRifle, addLoad, updateRifle, deleteRifle, updateLoad, deleteLoad, deleteSession, getProject, addProject, updateProject, deleteProject, getDopeCard, addDopeCard, deleteDopeCard, exportSessionsCSV]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
