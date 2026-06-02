import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MushafPage } from '../quran/MushafPage';
import { useSaveBookmark } from '../reading/useBookmark';
import { FontSizeControl } from '../components/FontSizeControl';
import { AudioProvider } from '../audio/AudioContext';
import { AudioBar } from '../audio/AudioBar';
import { usePageData } from '../quran/usePageData';
import { useReadingTracker } from '../reading/useReadingTracker';
import { ReadingStatsBar } from '../reading/ReadingStatsBar';

function ReadPageInner({ n }: { n: number }) {
  const navigate = useNavigate();
  const saveBookmark = useSaveBookmark();
  const { data } = usePageData(n);
  const [firstSurahAyah, setFirstSurahAyah] = useState<{ surah: number; ayah: number } | null>(null);

  useReadingTracker(n);

  useEffect(() => { saveBookmark.mutate(n); /* eslint-disable-next-line */ }, [n]);
  useEffect(() => {
    const w = data?.lines.flatMap((l) => l.words).find((x) => x.type === 'word');
    setFirstSurahAyah(w ? { surah: w.surah, ayah: w.ayah } : null);
  }, [data]);

  const navBtn = 'h-9 w-9 grid place-items-center rounded-full border border-line-light dark:border-line-dark text-muted hover:text-ink dark:hover:text-ink-dark disabled:opacity-30 disabled:hover:text-muted transition';

  return (
    <div className="flex min-h-dvh flex-col">
      {/* reading toolbar */}
      <header className="sticky top-0 z-10 border-b border-line-light dark:border-line-dark bg-surface-light/85 dark:bg-surface-dark/85 backdrop-blur">
        <div className="relative mx-auto flex max-w-3xl items-center justify-center gap-5 px-5 py-3">
          <button onClick={() => navigate(`/read/page/${n - 1}`)} disabled={n <= 1} className={navBtn} aria-label="Previous page">‹</button>
          <div className="text-center leading-none">
            <div className="font-display text-lg">Page {n}</div>
            <div className="text-[11px] text-muted mt-0.5">of 604</div>
          </div>
          <button onClick={() => navigate(`/read/page/${n + 1}`)} disabled={n >= 604} className={navBtn} aria-label="Next page">›</button>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block">
            <FontSizeControl />
          </div>
        </div>
      </header>

      {/* the mushaf page, presented as a sheet */}
      <div className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark shadow-lift">
          <MushafPage page={n} />
        </div>
      </div>

      {/* pinned player + live counters */}
      <div className="sticky bottom-0 z-10 border-t border-line-light dark:border-line-dark bg-sidebar-light/95 dark:bg-sidebar-dark/95 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <ReadingStatsBar />
          <AudioBar firstSurahAyah={firstSurahAyah} />
        </div>
      </div>
    </div>
  );
}

export default function ReadPage() {
  const { page } = useParams();
  const n = Math.min(604, Math.max(1, Number(page) || 1));
  return (
    <AudioProvider>
      <ReadPageInner n={n} />
    </AudioProvider>
  );
}
