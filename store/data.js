import { createContext, useContext, useState, useCallback, useMemo } from 'react';

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

export function DataProvider({ children }) {
  const [rifles, setRifles] = useState(SEED_RIFLES);
  const [loads, setLoads] = useState(SEED_LOADS);
  const [sessions, setSessions] = useState(SEED_SESSIONS);

  const getRifle = useCallback((id) => rifles.find(r => r.id === id), [rifles]);
  const getLoad = useCallback((id) => loads.find(l => l.id === id), [loads]);
  const getSession = useCallback((id) => sessions.find(s => s.id === id), [sessions]);

  const getRifleName = useCallback((id) => {
    const r = rifles.find(r => r.id === id);
    return r ? r.name : 'Unknown';
  }, [rifles]);

  const addSession = useCallback((session) => {
    setSessions(prev => [session, ...prev]);
  }, []);

  const addRifle = useCallback((rifle) => {
    setRifles(prev => [...prev, rifle]);
  }, []);

  const addLoad = useCallback((load) => {
    setLoads(prev => [...prev, load]);
  }, []);

  const analyticsData = useMemo(() => ({
    all: { trend: [0.71, 0.62, 0.58, 0.55, 0.49, 0.44, 0.38, 0.31], avg: '0.58', rounds: 486, latestShots: 7, latestGroup: '0.42' },
    'Impact 737R': { trend: [0.62, 0.55, 0.51, 0.47, 0.44, 0.40, 0.36, 0.31], avg: '0.46', rounds: 214, latestShots: 7, latestGroup: '0.31' },
    'Tikka T3x TAC A1': { trend: [0.88, 0.79, 0.74, 0.71, 0.68, 0.72, 0.66, 0.61], avg: '0.72', rounds: 132, latestShots: 5, latestGroup: '0.61' },
    'AI AXSR': { trend: [0.44, 0.39, 0.35, 0.33, 0.30, 0.31, 0.29, 0.26], avg: '0.34', rounds: 140, latestShots: 6, latestGroup: '0.28' },
  }), []);

  const value = useMemo(() => ({
    rifles, loads, sessions,
    getRifle, getLoad, getSession, getRifleName,
    addSession, addRifle, addLoad,
    analyticsData,
  }), [rifles, loads, sessions, getRifle, getLoad, getSession, getRifleName, addSession, addRifle, addLoad, analyticsData]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
