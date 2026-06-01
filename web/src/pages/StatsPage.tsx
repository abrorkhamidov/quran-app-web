import { Link } from 'react-router-dom';
import { useStatsSummary, localDate } from '../reading/useStatsSummary';
import { useCalendar } from '../stats/useCalendar';
import { isoAddDays } from '../stats/dateUtils';
import { Heatmap } from '../stats/Heatmap';
import { MinutesChart } from '../stats/MinutesChart';

function fmtTime(s: number) { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; }

export default function StatsPage() {
  const today = localDate();
  const from = isoAddDays(today, -118);
  const { data: summary } = useStatsSummary();
  const { data: calendar } = useCalendar(from, today);
  const secondsByDate = new Map((calendar ?? []).map((d) => [d.date, d.secondsRead]));

  const life = summary?.lifetime;
  const stats = [
    { label: 'Total Hasanat', value: (life?.hasanat ?? 0).toLocaleString() },
    { label: 'Verses', value: (life?.verses ?? 0).toLocaleString() },
    { label: 'Pages', value: (life?.pages ?? 0).toLocaleString() },
    { label: 'Time', value: fmtTime(life?.seconds ?? 0) },
  ];

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-accent-soft">‹ Home</Link>
        <h1 className="text-lg font-semibold">Your stats</h1>
        <span className="w-10" />
      </div>

      <div className="flex justify-around rounded-2xl bg-card-light dark:bg-card-dark p-4 text-center">
        <div><div className="text-xl font-bold">🔥 {summary?.streak.current ?? 0}</div><div className="text-xs text-muted">current</div></div>
        <div><div className="text-xl font-bold">{summary?.streak.longest ?? 0}</div><div className="text-xs text-muted">longest</div></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-card-light dark:bg-card-dark p-4">
            <div className="text-lg font-semibold text-accent-soft">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <div className="text-xs uppercase text-muted">Activity (last 17 weeks)</div>
        <Heatmap end={today} secondsByDate={secondsByDate} />
      </section>

      <section className="space-y-2">
        <div className="text-xs uppercase text-muted">Minutes per day (last 30 days)</div>
        <MinutesChart end={today} secondsByDate={secondsByDate} />
      </section>
    </div>
  );
}
