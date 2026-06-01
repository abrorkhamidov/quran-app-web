import { useEffect, useMemo, useState } from 'react';
import { usePageData } from './usePageData';
import { ensureQcf2Css, pageFontFamily } from './pageFont';
import { MushafLine } from './MushafLine';
import { FavoriteBar } from './FavoriteBar';
import { useSettings } from '../settings/useSettings';
import { useAudio } from '../audio/useAudio';

export function MushafPage({ page }: { page: number }) {
  const { data, isLoading, isError } = usePageData(page);
  const { fontScale } = useSettings();
  const { highlighted } = useAudio();
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  useEffect(() => { ensureQcf2Css(); }, []);
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
        className="mx-auto max-w-2xl px-4 py-6 text-ink dark:text-ink-dark"
        style={{ fontFamily: pageFontFamily(page), fontSize: `${28 * fontScale}px` }}
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
      {selected && <FavoriteBar selected={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
