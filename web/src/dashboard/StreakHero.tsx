import type { StatsSummary } from '../reading/useStatsSummary';
import { formatDuration } from '../lib/formatDuration';

export function StreakHero({ summary }: { summary?: StatsSummary }) {
  const streak = summary?.streak.current ?? 0;
  const goal = summary?.goal ?? { type: 'time' as const, target: 120 };
  const secs = summary?.today.secondsRead ?? 0;
  const current = goal.type === 'ayahs' ? (summary?.today.versesRead ?? 0) : secs;
  const pct = Math.min(100, Math.round((current / goal.target) * 100));
  const currentLabel = goal.type === 'ayahs' ? String(current) : formatDuration(current);
  const targetLabel = goal.type === 'ayahs' ? `${goal.target} ayahs` : formatDuration(goal.target);
  return (
    <div className="rounded-2xl bg-card-light dark:bg-card-dark p-6 text-center">
      <div className="text-4xl font-bold">🔥 {streak}</div>
      <div className="text-muted text-sm">{streak === 1 ? 'day streak' : 'day streak'}</div>
      <div className="mt-4 text-xs text-muted flex justify-between">
        <span>Today's goal</span>
        <span>{currentLabel} / {targetLabel}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-light dark:bg-surface-dark mt-1 overflow-hidden">
        <div className="h-2 rounded-full bg-accent-soft transition-all" style={{ width: `${pct}%` }} />
      </div>
      {summary?.today.goalMet && <div className="text-accent-soft text-xs mt-2">Goal complete ✓</div>}
    </div>
  );
}
