import { createContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import api from '../lib/api';
import { useAuth } from '../auth/useAuth';

type Theme = 'light' | 'dark';
export type GoalLevel = 'egg' | 'steady' | 'beast';
export type ReadingStyle = 'mushaf' | 'tajweed';
export const GOAL_SECONDS: Record<GoalLevel, number> = { egg: 120, steady: 600, beast: 1800 };

type SettingsValue = {
  theme: Theme;
  toggleTheme: () => void;
  fontScale: number;
  setFontScale: (n: number) => void;
  reciterId: number;
  setReciterId: (id: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (n: number) => void;
  goalLevel: GoalLevel;
  setGoalLevel: (l: GoalLevel) => void;
  readingStyle: ReadingStyle;
  setReadingStyle: (s: ReadingStyle) => void;
  onboarded: boolean;
  completeOnboarding: (l: GoalLevel) => void;
  settingsLoaded: boolean;
};

export const SettingsContext = createContext<SettingsValue | null>(null);

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.8;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [fontScale, setFontScaleState] = useState<number>(() => Number(localStorage.getItem('fontScale')) || 1);
  const [reciterId, setReciterIdState] = useState<number>(() => Number(localStorage.getItem('reciterId')) || 7);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(() => Number(localStorage.getItem('playbackSpeed')) || 1);
  const [goalLevel, setGoalLevelState] = useState<GoalLevel>('egg');
  const [readingStyle, setReadingStyleState] = useState<ReadingStyle>(() => (localStorage.getItem('readingStyle') as ReadingStyle) || 'mushaf');
  const [onboarded, setOnboardedState] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('fontScale', String(fontScale)); }, [fontScale]);
  useEffect(() => { localStorage.setItem('reciterId', String(reciterId)); }, [reciterId]);
  useEffect(() => { localStorage.setItem('playbackSpeed', String(playbackSpeed)); }, [playbackSpeed]);
  useEffect(() => { localStorage.setItem('readingStyle', readingStyle); }, [readingStyle]);

  // hydrate from server on login; reset on logout
  useEffect(() => {
    if (!user) { hydrated.current = false; setSettingsLoaded(false); return; }
    let cancelled = false;
    api.get('/settings').then(({ data }) => {
      if (cancelled) return;
      setThemeState(data.theme);
      setFontScaleState(data.fontScale);
      setReciterIdState(data.preferredReciterId);
      setGoalLevelState(data.goalLevel);
      if (data.readingStyle) setReadingStyleState(data.readingStyle);
      setOnboardedState(data.onboarded);
      hydrated.current = true;
      setSettingsLoaded(true);
    }).catch(() => { hydrated.current = true; setSettingsLoaded(true); });
    return () => { cancelled = true; };
  }, [user]);

  function patch(partial: Record<string, unknown>) {
    if (user && hydrated.current) api.patch('/settings', partial).catch(() => {});
  }

  function setTheme(t: Theme) { setThemeState(t); patch({ theme: t }); }
  function toggleTheme() { setTheme(theme === 'light' ? 'dark' : 'light'); }
  function setFontScale(n: number) { const v = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(n.toFixed(2)))); setFontScaleState(v); patch({ fontScale: v }); }
  function setReciterId(id: number) { setReciterIdState(id); patch({ preferredReciterId: id }); }
  function setPlaybackSpeed(n: number) { setPlaybackSpeedState(SPEEDS.includes(n) ? n : 1); } // local only
  function setGoalLevel(l: GoalLevel) { setGoalLevelState(l); patch({ goalLevel: l }); }
  function setReadingStyle(s: ReadingStyle) { setReadingStyleState(s); patch({ readingStyle: s }); }
  function completeOnboarding(l: GoalLevel) { setGoalLevelState(l); setOnboardedState(true); patch({ goalLevel: l, onboarded: true }); }

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, fontScale, setFontScale, reciterId, setReciterId, playbackSpeed, setPlaybackSpeed, goalLevel, setGoalLevel, readingStyle, setReadingStyle, onboarded, completeOnboarding, settingsLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const PLAYBACK_SPEEDS = SPEEDS;
