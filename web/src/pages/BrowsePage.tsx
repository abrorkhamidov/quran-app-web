import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSurahs, useJuzList } from '../quran/useQuranMeta';
import { pageForSurah, pageForJuz } from '../quran/quranIndex';

type Tab = 'surah' | 'juz';

export default function BrowsePage() {
  const navigate = useNavigate();
  const { data: surahs, isLoading: surahsLoading } = useSurahs();
  const { data: juz, isLoading: juzLoading } = useJuzList();
  const [tab, setTab] = useState<Tab>('surah');

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

  const row = 'flex items-center gap-4 w-full rounded-2xl border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark px-4 py-3 text-left hover:border-accent-soft transition';

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
            <button key={s.id} onClick={() => navigate(`/read/page/${pageForSurah(surahs, s.id)}`)} className={row}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{s.id}</span>
              <span className="flex-1">
                <span className="block font-medium">{s.name}</span>
                <span className="block text-xs text-muted">{s.ayahCount} ayahs · {s.revelation === 'meccan' ? 'Meccan' : 'Medinan'}</span>
              </span>
              <span className="font-quran text-xl">{s.arabicName}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'juz' && (
        <div className="space-y-2">
          {juzLoading && <p className="text-muted">Loading…</p>}
          {juz?.map((j) => (
            <button key={j.juz} onClick={() => navigate(`/read/page/${pageForJuz(juz, j.juz)}`)} className={row}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{j.juz}</span>
              <span className="flex-1">
                <span className="block font-medium">Juz {j.juz}</span>
                <span className="block text-xs text-muted">starts {j.startSurah}:{j.startAyah} · {j.ayahCount} ayahs</span>
              </span>
              <span className="text-xs text-muted">p.{j.startPage}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
