import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSurahs, useJuzList } from '../quran/useQuranMeta';
import { pageForSurah, pageForJuz } from '../quran/quranIndex';
import { useCoverage } from '../quran/useCoverage';
import { ProgressRing } from '../quran/ProgressRing';
import { useSettings } from '../settings/useSettings';

type Tab = 'surah' | 'juz';

export default function BrowsePage() {
  const navigate = useNavigate();
  const { data: surahs, isLoading: surahsLoading } = useSurahs();
  const { data: juz, isLoading: juzLoading } = useJuzList();
  const { data: coverage } = useCoverage();
  const surahPct = new Map((coverage?.surah ?? []).map((d) => [d.id, d.percent]));
  const juzPct = new Map((coverage?.juz ?? []).map((d) => [d.id, d.percent]));
  const [tab, setTab] = useState<Tab>('surah');
  const { focusType, focusId, setFocus } = useSettings();
  const isFocus = (type: 'juz' | 'surah', id: number) => focusType === type && focusId === id;
  const toggleFocus = (type: 'juz' | 'surah', id: number) => setFocus(isFocus(type, id) ? 'none' : type, id);
  const focusBtn = (active: boolean) =>
    'shrink-0 grid h-8 w-8 place-items-center rounded-full border transition ' +
    (active ? 'border-accent-soft text-accent-soft' : 'border-line-light dark:border-line-dark text-muted hover:border-accent-soft');

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={
        'rounded-xl px-4 py-2 text-sm transition ' +
        (tab === key ? 'bg-accent text-white' : 'text-muted hover:text-ink dark:hover:text-ink-dark')
      }
    >
      {label}
    </button>
  );

  const row = 'flex items-center gap-3 w-full rounded-2xl border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark px-4 py-3 hover:border-accent-soft transition';
  const nav = 'flex items-center gap-4 flex-1 min-w-0 text-left';

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 lg:px-12 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl tracking-tight">Browse</h1>
        <p className="mt-1 text-muted">Jump to any surah or juz.</p>
      </header>

      <div className="mb-5 inline-flex gap-1 rounded-2xl bg-surface-light dark:bg-surface-dark p-1">
        {tabBtn('surah', 'Surahs')}
        {tabBtn('juz', 'Juz')}
      </div>

      {tab === 'surah' && (
        <div className="space-y-2">
          {surahsLoading && <p className="text-muted">Loading…</p>}
          {surahs?.map((s) => (
            <div key={s.id} className={row}>
              <button onClick={() => navigate(`/read/page/${pageForSurah(surahs, s.id)}`)} className={nav}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{s.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-xs text-muted">{s.ayahCount} ayahs · {s.revelation === 'meccan' ? 'Meccan' : 'Medinan'}</span>
                </span>
                <span className="font-quran text-xl">{s.arabicName}</span>
              </button>
              <ProgressRing percent={surahPct.get(s.id) ?? 0} />
              <button onClick={() => toggleFocus('surah', s.id)} className={focusBtn(isFocus('surah', s.id))} aria-label="Set as focus" title="Set as focus">◎</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'juz' && (
        <div className="space-y-2">
          {juzLoading && <p className="text-muted">Loading…</p>}
          {juz?.map((j) => (
            <div key={j.juz} className={row}>
              <button onClick={() => navigate(`/read/page/${pageForJuz(juz, j.juz)}`)} className={nav}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{j.juz}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Juz {j.juz}</span>
                  <span className="block text-xs text-muted">starts {j.startSurah}:{j.startAyah} · {j.ayahCount} ayahs</span>
                </span>
                <span className="text-xs text-muted">p.{j.startPage}</span>
              </button>
              <ProgressRing percent={juzPct.get(j.juz) ?? 0} />
              <button onClick={() => toggleFocus('juz', j.juz)} className={focusBtn(isFocus('juz', j.juz))} aria-label="Set as focus" title="Set as focus">◎</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
