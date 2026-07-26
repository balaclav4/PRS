import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import * as db from '../lib/db';

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

const DataContext = createContext();

const SEED = { rifles: SEED_RIFLES, loads: SEED_LOADS, sessions: SEED_SESSIONS };

export function DataProvider({ children }) {
  const [rifles, setRifles] = useState(SEED_RIFLES);
  const [loads, setLoads] = useState(SEED_LOADS);
  const [sessions, setSessions] = useState(SEED_SESSIONS);
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

  const exportSessionsCSV = useCallback(() => {
    const header = 'Name,Date,Rifle,Load,Distance (yd),Suppressed,Best Group (in),Mean Radius (in),MV (fps),SD (fps),Targets,Total Shots';
    const rows = sessions.map(s => {
      const rifleName = rifles.find(r => r.id === s.rifleId)?.name || '';
      const loadName = loads.find(l => l.id === s.loadId)?.name || '';
      const totalShots = s.targets.reduce((a, t) => a + t.shots.length, 0);
      return [s.name, s.date, rifleName, loadName, s.distanceYd, s.suppressed ? 'Yes' : 'No', s.best, s.meanRadius, s.mv, s.sd, s.targetCount, totalShots]
        .map(v => `"${v}"`).join(',');
    });
    return header + '\n' + rows.join('\n');
  }, [sessions, rifles, loads]);

  const value = useMemo(() => ({
    rifles, loads, sessions, ready,
    getRifle, getLoad, getSession, getRifleName,
    addSession, updateSession, addRifle, addLoad,
    updateRifle, deleteRifle,
    updateLoad, deleteLoad,
    deleteSession,
    exportSessionsCSV,
  }), [rifles, loads, sessions, ready, getRifle, getLoad, getSession, getRifleName, addSession, updateSession, addRifle, addLoad, updateRifle, deleteRifle, updateLoad, deleteLoad, deleteSession, exportSessionsCSV]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
