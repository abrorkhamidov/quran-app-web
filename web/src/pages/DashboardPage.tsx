import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useStatsSummary } from '../reading/useStatsSummary';
import { useWeek } from '../dashboard/useWeek';
import { useBookmark } from '../reading/useBookmark';
import { FlameIcon } from '../layout/icons';
import { formatDuration } from '../lib/formatDuration';
import { KhatmBar } from '../dashboard/KhatmBar';
import { useSurahs, useJuzList } from '../quran/useQuranMeta';
import { ayahsLeftInJuz, juzOf } from '../quran/quranIndex';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dowLetter = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary } = useStatsSummary();
  const { data: week } = useWeek();
  const { data: bookmark } = useBookmark();
  const { data: surahs } = useSurahs();
  const { data: juz } = useJuzList();
  const resumeSurah = bookmark?.surah;
  const resumeAyah = bookmark?.ayah;
  const surahName = surahs && resumeSurah ? surahs.find((s) => s.id === resumeSurah)?.name : undefined;
  const juzInfo =
    surahs && juz && resumeSurah && resumeAyah
      ? { n: juzOf(surahs, juz, resumeSurah, resumeAyah), left: ayahsLeftInJuz(surahs, juz, resumeSurah, resumeAyah) }
      : undefined;

  const t = summary?.today;
  const goal = summary?.goalTargetSeconds ?? 120;
  const secs = t?.secondsRead ?? 0;
  const pct = Math.min(100, Math.round((secs / goal) * 100));
  const resume = bookmark?.page ?? 1;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const metrics = [
    { label: 'Hasanat', value: (t?.hasanat ?? 0).toLocaleString(), accent: true },
    { label: 'Verses', value: String(t?.versesRead ?? 0), accent: false },
    { label: 'Time', value: formatDuration(secs), accent: false },
    { label: 'Pages', value: String(t?.pagesRead ?? 0), accent: false },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 py-8 lg:py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">{dateLabel}</p>
        <h1 className="font-display text-3xl sm:text-4xl mt-1 tracking-tight">
          Assalamu alaikum, {user?.name}
        </h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Continue / today's goal */}
        <section className="lg:col-span-7 rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7 flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Today's goal</span>
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <FlameIcon className="h-4 w-4 text-accent-soft" /> {summary?.streak.current ?? 0} day streak
            </span>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-display text-5xl leading-none">{formatDuration(secs)}</span>
            <span className="text-muted mb-1">/ {formatDuration(goal)}</span>
            {t?.goalMet && <span className="mb-1 text-sm text-accent-soft">complete ✓</span>}
          </div>
          <div className="mt-4 h-2 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
            <div className="h-full rounded-full bg-accent-soft transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          {juzInfo && (
            <p className="mt-3 text-sm text-muted">
              {juzInfo.left} ayah{juzInfo.left === 1 ? '' : 's'} left to finish Juz {juzInfo.n}
            </p>
          )}
          <Link
            to={`/read/page/${resume}`}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent text-white py-4 font-medium hover:opacity-95 transition"
          >
            {bookmark
              ? `Continue · ${surahName ?? `page ${resume}`}${surahName ? ` ${resumeSurah}:${resumeAyah}` : ''}`
              : 'Start reading'}
            <span aria-hidden>→</span>
          </Link>
        </section>

        {/* Metrics */}
        <section className="lg:col-span-5 grid grid-cols-2 gap-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-5 flex flex-col justify-between min-h-[108px]"
            >
              <span className="text-xs uppercase tracking-[0.14em] text-muted">{m.label}</span>
              <span className={`font-display text-3xl mt-3 ${m.accent ? 'text-accent-soft' : ''}`}>{m.value}</span>
            </div>
          ))}
        </section>

        {/* Week */}
        <section className="lg:col-span-12 rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">This week</span>
            <Link to="/stats" className="text-sm text-accent-soft hover:underline">All stats →</Link>
          </div>
          <div className="flex justify-between">
            {week?.map((d, i) => (
              <div
                key={d.date}
                title={`${d.date}: ${formatDuration(d.secondsRead)}`}
                className={[
                  'h-11 w-11 rounded-2xl grid place-items-center text-sm transition-colors',
                  d.goalMet
                    ? 'bg-accent-soft text-white'
                    : i === week.length - 1
                      ? 'border border-accent-soft text-muted'
                      : 'border border-line-light dark:border-line-dark text-muted',
                ].join(' ')}
              >
                {dowLetter(d.date)}
              </div>
            ))}
          </div>
        </section>
        {/* Qur'an completion */}
        <section className="lg:col-span-12 rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <KhatmBar />
        </section>
      </div>
    </div>
  );
}
