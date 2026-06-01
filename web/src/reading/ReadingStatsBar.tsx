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
  const cells = [
    { label: 'Hasanat', value: (today?.hasanat ?? 0).toLocaleString(), accent: true },
    { label: 'Verses', value: String(today?.versesRead ?? 0), accent: false },
    { label: 'Time', value: fmt(seconds), accent: false },
    { label: 'Pages', value: String(today?.pagesRead ?? 0), accent: false },
  ];
  return (
    <div className="flex justify-around border-b border-line-light dark:border-line-dark px-4 py-2.5 text-center">
      {cells.map((c) => (
        <div key={c.label} className="leading-tight">
          <div className={`font-display text-base ${c.accent ? 'text-accent-soft' : 'text-ink dark:text-ink-dark'}`}>{c.value}</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
