import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';
type SettingsValue = {
  theme: Theme;
  toggleTheme: () => void;
  fontScale: number;        // multiplier on the base Mushaf size
  setFontScale: (n: number) => void;
};

export const SettingsContext = createContext<SettingsValue | null>(null);

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.8;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [fontScale, setFontScaleState] = useState<number>(() => Number(localStorage.getItem('fontScale')) || 1);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem('fontScale', String(fontScale)); }, [fontScale]);

  function toggleTheme() { setTheme((t) => (t === 'light' ? 'dark' : 'light')); }
  function setFontScale(n: number) { setFontScaleState(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(n.toFixed(2))))); }

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, fontScale, setFontScale }}>
      {children}
    </SettingsContext.Provider>
  );
}
