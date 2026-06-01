import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';
type SettingsValue = {
  theme: Theme;
  toggleTheme: () => void;
  fontScale: number;
  setFontScale: (n: number) => void;
  reciterId: number;
  setReciterId: (id: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (n: number) => void;
};

export const SettingsContext = createContext<SettingsValue | null>(null);

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.8;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [fontScale, setFontScaleState] = useState<number>(() => Number(localStorage.getItem('fontScale')) || 1);
  const [reciterId, setReciterIdState] = useState<number>(() => Number(localStorage.getItem('reciterId')) || 7);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(() => Number(localStorage.getItem('playbackSpeed')) || 1);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('fontScale', String(fontScale)); }, [fontScale]);
  useEffect(() => { localStorage.setItem('reciterId', String(reciterId)); }, [reciterId]);
  useEffect(() => { localStorage.setItem('playbackSpeed', String(playbackSpeed)); }, [playbackSpeed]);

  function toggleTheme() { setTheme((t) => (t === 'light' ? 'dark' : 'light')); }
  function setFontScale(n: number) { setFontScaleState(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(n.toFixed(2))))); }
  function setReciterId(id: number) { setReciterIdState(id); }
  function setPlaybackSpeed(n: number) { setPlaybackSpeedState(SPEEDS.includes(n) ? n : 1); }

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, fontScale, setFontScale, reciterId, setReciterId, playbackSpeed, setPlaybackSpeed }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const PLAYBACK_SPEEDS = SPEEDS;
