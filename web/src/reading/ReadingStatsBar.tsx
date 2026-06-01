import { useEffect, useState } from 'react';
import { useStatsSummary } from './useStatsSummary';

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ReadingStatsBar() {
  const { data } = useStatsSummary();
  // tick the displayed time locally between flushes for a live feel
  const [extra, setExtra] = useState(0);
  useEffect(() => { setExtra(0); }, [data?.today.secondsRead]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) setExtra((e) => e + 1); }, 1000);
    return () => clearInterval(id);
  }, []);

  const today = data?.today;
  const seconds = (today?.secondsRead ?? 0) + extra;
  return (
    <div className="flex justify-around text-center px-4 py-2 text-xs text-muted border-t border-muted/20">
      <div><div className="text-accent-soft font-semibold">{(today?.hasanat ?? 0).toLocaleString()}</div>Hasanat</div>
      <div><div className="text-ink dark:text-ink-dark font-semibold">{today?.versesRead ?? 0}</div>Verses</div>
      <div><div className="text-ink dark:text-ink-dark font-semibold">{fmt(seconds)}</div>Time</div>
      <div><div className="text-ink dark:text-ink-dark font-semibold">{today?.pagesRead ?? 0}</div>Pages</div>
    </div>
  );
}
