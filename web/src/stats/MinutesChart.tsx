import { lastNDays } from './dateUtils';
import { formatDuration } from '../lib/formatDuration';

export function MinutesChart({ end, secondsByDate, days = 30 }: { end: string; secondsByDate: Map<string, number>; days?: number }) {
  const dates = lastNDays(end, days);
  const minutes = dates.map((d) => Math.round((secondsByDate.get(d) ?? 0) / 60));
  const max = Math.max(1, ...minutes);
  return (
    <div className="flex items-end gap-[2px] h-28">
      {dates.map((d, i) => (
        <div key={d} title={`${d}: ${formatDuration(secondsByDate.get(d) ?? 0)}`} className="flex-1 bg-accent-soft/70 rounded-t-sm" style={{ height: `${(minutes[i] / max) * 100}%`, minHeight: minutes[i] > 0 ? '2px' : '0' }} />
      ))}
    </div>
  );
}
