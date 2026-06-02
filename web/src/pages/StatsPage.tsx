import { useStatsSummary, localDate } from '../reading/useStatsSummary';
import { useCalendar } from '../stats/useCalendar';
import { isoAddDays } from '../stats/dateUtils';
import { Heatmap } from '../stats/Heatmap';
import { MinutesChart } from '../stats/MinutesChart';
import { formatDuration } from '../lib/formatDuration';
import { KhatmBar } from '../dashboard/KhatmBar';

export default function StatsPage() {
  const today = localDate();
  const from = isoAddDays(today, -118);
  const { data: summary } = useStatsSummary();
  const { data: calendar } = useCalendar(from, today);
  const secondsByDate = new Map((calendar ?? []).map((d) => [d.date, d.secondsRead]));

  const life = summary?.lifetime;
  const stats = [
    { label: 'Total Hasanat', value: (life?.hasanat ?? 0).toLocaleString(), accent: true },
    { label: 'Verses', value: (life?.verses ?? 0).toLocaleString(), accent: false },
    { label: 'Pages', value: (life?.pages ?? 0).toLocaleString(), accent: false },
    { label: 'Time', value: formatDuration(life?.seconds ?? 0), accent: false },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">Your stats</h1>
        <p className="mt-1 text-muted">Your lifetime journey with the Qur'an.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-5 flex flex-col justify-between min-h-[108px]"
          >
            <span className="text-xs uppercase tracking-[0.14em] text-muted">{s.label}</span>
            <span className={`font-display text-3xl mt-3 ${s.accent ? 'text-accent-soft' : ''}`}>{s.value}</span>
          </div>
        ))}

        <div className="rounded-2xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-5 flex flex-col justify-between min-h-[108px]">
          <span className="text-xs uppercase tracking-[0.14em] text-muted">Streak</span>
          <div className="mt-3 flex items-end gap-4">
            <span className="flex flex-col">
              <span className="font-display text-3xl text-accent-soft leading-none">{summary?.streak.current ?? 0}</span>
              <span className="text-xs text-muted mt-1">current</span>
            </span>
            <span className="flex flex-col">
              <span className="font-display text-3xl leading-none">{summary?.streak.longest ?? 0}</span>
              <span className="text-xs text-muted mt-1">longest</span>
            </span>
          </div>
        </div>
      </div>

      <section className="mt-5 rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
        <KhatmBar />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <div className="text-xs uppercase tracking-[0.14em] text-muted mb-5">Activity (last 17 weeks)</div>
          <Heatmap end={today} secondsByDate={secondsByDate} />
        </section>

        <section className="rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <div className="text-xs uppercase tracking-[0.14em] text-muted mb-5">Minutes per day (last 30 days)</div>
          <MinutesChart end={today} secondsByDate={secondsByDate} />
        </section>
      </div>
    </div>
  );
}
