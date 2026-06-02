import { useEffect, useMemo, useState } from 'react';
import { usePageData } from './usePageData';
import { useTajweedPage } from './useTajweedPage';
import { ensureQcf2Css, pageFontFamily } from './pageFont';
import { MushafLine } from './MushafLine';
import { FavoriteBar } from './FavoriteBar';
import { TAJWEED_LEGEND } from './tajweedColors';
import type { RenderWord } from './types';
import { useSettings } from '../settings/useSettings';
import { useAudio } from '../audio/useAudio';

type RenderLine = { line: number; words: RenderWord[] };

export function MushafPage({ page }: { page: number }) {
  const { fontScale, readingStyle } = useSettings();
  const tajweed = readingStyle === 'tajweed';
  const mushafQ = usePageData(page);
  const tajweedQ = useTajweedPage(page, tajweed);
  const active = tajweed ? tajweedQ : mushafQ;
  const data = active.data as { page: number; lines: RenderLine[] } | undefined;
  const { isLoading, isError } = active;

  const { highlighted } = useAudio();
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  useEffect(() => { if (!tajweed) ensureQcf2Css(); }, [tajweed]);
  useEffect(() => { setSelected(null); }, [page]);

  // position per word, computed page-globally: count only 'word' type, per ayah, 1-based
  const positionsByLine = useMemo(() => {
    const counters: Record<string, number> = {};
    return (data?.lines ?? []).map((line) =>
      line.words.map((w) => {
        if (w.type !== 'word') return 0;
        const k = `${w.surah}:${w.ayah}`;
        counters[k] = (counters[k] ?? 0) + 1;
        return counters[k];
      }),
    );
  }, [data]);

  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;

  return (
    <>
      <div
        className={`mx-auto max-w-2xl px-4 py-6 text-ink dark:text-ink-dark ${tajweed ? 'font-quran' : ''}`}
        style={{
          fontFamily: tajweed ? undefined : pageFontFamily(page),
          fontSize: `${(tajweed ? 30 : 28) * fontScale}px`,
          lineHeight: tajweed ? 2.45 : undefined,
        }}
      >
        {data.lines.map((line, li) => (
          <MushafLine
            key={line.line}
            line={line}
            positions={positionsByLine[li]}
            selected={selected}
            highlighted={highlighted}
            onSelect={setSelected}
          />
        ))}
      </div>

      {tajweed && (
        <div className="border-t border-line-light dark:border-line-dark px-6 sm:px-10 py-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
          {TAJWEED_LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {selected && <FavoriteBar selected={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
