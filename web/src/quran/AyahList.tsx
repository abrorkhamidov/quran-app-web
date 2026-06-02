import { useEffect, useMemo, useState } from 'react';
import { usePageData } from './usePageData';
import { useAyahTexts } from './useAyahTexts';
import { useSurahs } from './useQuranMeta';
import { FavoriteBar } from './FavoriteBar';
import { useSettings } from '../settings/useSettings';
import { useAudio } from '../audio/useAudio';

export function AyahList({ page }: { page: number }) {
  const { data, isLoading, isError } = usePageData(page);
  const { fontScale } = useSettings();
  const { highlighted } = useAudio();
  const { data: surahs } = useSurahs();
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  useEffect(() => { setSelected(null); }, [page]);

  // ordered distinct ayahs present on this page, in reading order
  const pageAyahs = useMemo(() => {
    const seen = new Set<string>();
    const out: { surah: number; ayah: number }[] = [];
    for (const line of data?.lines ?? []) {
      for (const w of line.words) {
        const k = `${w.surah}:${w.ayah}`;
        if (!seen.has(k)) { seen.add(k); out.push({ surah: w.surah, ayah: w.ayah }); }
      }
    }
    return out;
  }, [data]);

  const surahIds = useMemo(() => [...new Set(pageAyahs.map((a) => a.surah))], [pageAyahs]);
  const { data: textMap } = useAyahTexts(surahIds);

  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;

  const surahName = (id: number) => surahs?.find((s) => s.id === id)?.name ?? `Surah ${id}`;

  return (
    <>
      <div className="mx-auto max-w-2xl px-5 sm:px-8 py-6 space-y-5">
        {pageAyahs.map((a, i) => {
          const t = textMap?.get(`${a.surah}:${a.ayah}`);
          const isNewSurah = i === 0 || pageAyahs[i - 1].surah !== a.surah;
          const playing = highlighted?.surah === a.surah && highlighted?.ayah === a.ayah;
          return (
            <div key={`${a.surah}:${a.ayah}`}>
              {isNewSurah && (
                <div className="mb-3 mt-2 text-center">
                  <span className="font-display text-lg text-accent-soft">{surahName(a.surah)}</span>
                </div>
              )}
              <button
                onClick={() => setSelected({ surah: a.surah, ayah: a.ayah })}
                className={`w-full rounded-2xl px-4 py-4 text-left transition ${playing ? 'bg-accent/10' : 'hover:bg-line-light/40 dark:hover:bg-line-dark/40'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 grid h-6 min-w-[1.5rem] shrink-0 place-items-center rounded-full bg-accent/10 px-1.5 text-[11px] text-accent-soft">
                    {a.surah}:{a.ayah}
                  </span>
                  <div className="flex-1 space-y-2">
                    <p dir="rtl" className="font-quran leading-[2] text-ink dark:text-ink-dark" style={{ fontSize: `${26 * fontScale}px` }}>
                      {t?.text ?? '…'}
                    </p>
                    <p className="text-sm leading-relaxed text-muted">{t?.translation ?? ''}</p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {selected && <FavoriteBar selected={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
