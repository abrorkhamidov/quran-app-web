import { useEffect, useState } from 'react';
import { usePageData } from './usePageData';
import { ensureQcf2Css, pageFontFamily } from './pageFont';
import { MushafLine } from './MushafLine';
import { FavoriteBar } from './FavoriteBar';
import { useSettings } from '../settings/useSettings';

export function MushafPage({ page }: { page: number }) {
  const { data, isLoading, isError } = usePageData(page);
  const { fontScale } = useSettings();
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  useEffect(() => { ensureQcf2Css(); }, []);
  useEffect(() => { setSelected(null); }, [page]); // clear selection when page changes

  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;

  return (
    <>
      <div
        className="mx-auto max-w-2xl px-4 py-6 text-ink dark:text-ink-dark"
        style={{ fontFamily: pageFontFamily(page), fontSize: `${28 * fontScale}px` }}
      >
        {data.lines.map((line) => (
          <MushafLine key={line.line} line={line} selected={selected} onSelect={setSelected} />
        ))}
      </div>
      {selected && <FavoriteBar selected={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
