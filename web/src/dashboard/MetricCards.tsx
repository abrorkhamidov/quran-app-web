import type { StatsSummary } from '../reading/useStatsSummary';

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export function MetricCards({ summary }: { summary?: StatsSummary }) {
  const t = summary?.today;
  const cards = [
    { label: 'Hasanat', value: (t?.hasanat ?? 0).toLocaleString(), accent: true },
    { label: 'Verses', value: String(t?.versesRead ?? 0) },
    { label: 'Time', value: fmt(t?.secondsRead ?? 0) },
    { label: 'Pages', value: String(t?.pagesRead ?? 0) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl bg-card-light dark:bg-card-dark p-4">
          <div className={`text-xl font-semibold ${c.accent ? 'text-accent-soft' : 'text-ink dark:text-ink-dark'}`}>{c.value}</div>
          <div className="text-xs text-muted">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
