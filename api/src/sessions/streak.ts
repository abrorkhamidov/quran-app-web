export type StreakState = { currentStreak: number; longestStreak: number; lastActiveDate: string | null };

export function isoMinus1(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Compute the new streak when `date`'s goal is first met.
export function nextStreak(s: StreakState, date: string): StreakState {
  if (s.lastActiveDate === date) return s; // already counted today
  const current = s.lastActiveDate === isoMinus1(date) ? s.currentStreak + 1 : 1;
  return { currentStreak: current, longestStreak: Math.max(s.longestStreak, current), lastActiveDate: date };
}

// The streak still "alive" at read time only if the last active day is today or yesterday.
export function effectiveCurrent(s: StreakState, today: string): number {
  if (s.lastActiveDate === today || s.lastActiveDate === isoMinus1(today)) return s.currentStreak;
  return 0;
}
