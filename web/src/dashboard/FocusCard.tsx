import { useCoverage } from '../quran/useCoverage';
import { useSurahs } from '../quran/useQuranMeta';
import { useSettings } from '../settings/useSettings';

export function FocusCard() {
  const { focusType, focusId, setFocus } = useSettings();
  const { data: coverage } = useCoverage();
  const { data: surahs } = useSurahs();
  if (focusType === 'none' || focusId == null) return null;

  const dim = focusType === 'juz' ? coverage?.juz : coverage?.surah;
  const c = dim?.find((d) => d.id === focusId);
  const name = focusType === 'juz' ? `Juz ${focusId}` : surahs?.find((s) => s.id === focusId)?.name ?? `Surah ${focusId}`;
  const percent = c?.percent ?? 0;
  const left = c ? Math.max(0, c.ayahCount - c.ayahsRead) : 0;

  return (
    <section className="lg:col-span-12 rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.14em] text-muted">Focus</span>
        <button onClick={() => setFocus('none', null)} className="text-xs text-muted hover:text-ink dark:hover:text-ink-dark transition">Clear</button>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-display text-2xl">Finish {name}</span>
        <span className="text-sm text-muted">{percent}% · {left} ayah{left === 1 ? '' : 's'} left</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark">
        <div className="h-full rounded-full bg-accent-soft transition-all duration-500" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </section>
  );
}
