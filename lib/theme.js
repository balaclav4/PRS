import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const light = {
  bg: '#F4F3F8',
  card: '#FFFFFF',
  bd: '#ECEBF2',
  line: '#F2F1F7',
  tx: '#16151C',
  mut: '#8D8B99',
  fnt: '#B7B5C2',
  input: '#FFFFFF',
  ibd: '#E4E2EC',
  nav: 'rgba(255,255,255,0.94)',
  acs: '#F1EDFD',
  act: '#5A2FD0',
  avb: '#DDD8F5',
  avt: '#5A2FD0',
  inset: '#F7F6FB',
  tgt: '#FAF9FD',
  ring: '#E7E4F5',
  grid: '#EDECF3',
  st1: '#E8E7EE',
  st2: '#E1E0E9',
  oks: '#E7F6ED',
  okbd: '#C6EAD3',
  okt: '#15833E',
  warns: '#FBF0E1',
  warnt: '#B36A05',
  dngs: '#FBECEC',
  dngt: '#DC2626',
  primary: '#6D3BEB',
  primaryGradStart: '#7B4DF0',
  primaryGradEnd: '#5A2FD0',
  marker: '#F0872B',
  good: '#15A34A',
  warn: '#D97706',
  chart: '#8257F0',
  statusBar: 'dark',
};

const dark = {
  bg: '#111019',
  card: '#1A1922',
  bd: '#282634',
  line: '#26242F',
  tx: '#F2F1F6',
  mut: '#9997A6',
  fnt: '#66647A',
  input: '#201E29',
  ibd: '#302E3C',
  nav: 'rgba(20,19,26,0.92)',
  acs: '#251E3A',
  act: '#B49BF7',
  avb: '#2C2448',
  avt: '#C4AEF9',
  inset: '#221F2C',
  tgt: '#17161F',
  ring: '#332B4A',
  grid: '#26242F',
  st1: '#2A2833',
  st2: '#232130',
  oks: '#123020',
  okbd: '#204A31',
  okt: '#5FDB8B',
  warns: '#38290F',
  warnt: '#E8B056',
  dngs: '#3A1D1D',
  dngt: '#F16A6A',
  primary: '#6D3BEB',
  primaryGradStart: '#7B4DF0',
  primaryGradEnd: '#5A2FD0',
  marker: '#F0872B',
  good: '#15A34A',
  warn: '#D97706',
  chart: '#8257F0',
  statusBar: 'light',
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const toggle = useCallback(() => setIsDark(v => !v), []);
  const setDark = useCallback(() => setIsDark(true), []);
  const setLight = useCallback(() => setIsDark(false), []);
  const colors = useMemo(() => (isDark ? dark : light), [isDark]);
  const value = useMemo(
    () => ({ isDark, colors, toggle, setDark, setLight }),
    [isDark, colors, toggle, setDark, setLight]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function groupColor(value, colors, threshold = 0.5) {
  return parseFloat(value) <= threshold ? colors.okt : colors.tx;
}
