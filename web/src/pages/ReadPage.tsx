import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MushafPage } from '../quran/MushafPage';
import { useSaveBookmark } from '../reading/useBookmark';
import { ThemeToggle } from '../components/ThemeToggle';
import { FontSizeControl } from '../components/FontSizeControl';
import { AudioProvider } from '../audio/AudioContext';
import { AudioBar } from '../audio/AudioBar';
import { usePageData } from '../quran/usePageData';

function ReadPageInner({ n }: { n: number }) {
  const navigate = useNavigate();
  const saveBookmark = useSaveBookmark();
  const { data } = usePageData(n);
  const [firstSurahAyah, setFirstSurahAyah] = useState<{ surah: number; ayah: number } | null>(null);

  useEffect(() => { saveBookmark.mutate(n); /* eslint-disable-next-line */ }, [n]);
  useEffect(() => {
    const w = data?.lines.flatMap((l) => l.words).find((x) => x.type === 'word');
    setFirstSurahAyah(w ? { surah: w.surah, ayah: w.ayah } : null);
  }, [data]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex justify-between items-center px-4 py-3 text-sm border-b border-muted/20">
        <Link to="/" className="text-accent-soft">‹ Home</Link>
        <div className="flex items-center gap-4">
          <FontSizeControl />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex justify-between items-center px-4 py-2 text-sm text-muted">
        <button onClick={() => navigate(`/read/page/${n - 1}`)} disabled={n <= 1} className="disabled:opacity-30">‹ Prev</button>
        <span>Page {n} / 604</span>
        <button onClick={() => navigate(`/read/page/${n + 1}`)} disabled={n >= 604} className="disabled:opacity-30">Next ›</button>
      </div>
      <div className="flex-1"><MushafPage page={n} /></div>
      <AudioBar firstSurahAyah={firstSurahAyah} />
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
