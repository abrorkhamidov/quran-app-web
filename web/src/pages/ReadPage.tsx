import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MushafPage } from '../quran/MushafPage';
import { useSaveBookmark } from '../reading/useBookmark';

export default function ReadPage() {
  const { page } = useParams();
  const navigate = useNavigate();
  const n = Math.min(604, Math.max(1, Number(page) || 1));
  const saveBookmark = useSaveBookmark();

  useEffect(() => { saveBookmark.mutate(n); /* eslint-disable-next-line */ }, [n]);

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center px-4 py-3 text-sm text-muted border-b border-muted/20">
        <button onClick={() => navigate(`/read/page/${n - 1}`)} disabled={n <= 1} className="disabled:opacity-30">‹ Prev</button>
        <span>Page {n} / 604</span>
        <button onClick={() => navigate(`/read/page/${n + 1}`)} disabled={n >= 604} className="disabled:opacity-30">Next ›</button>
      </div>
      <MushafPage page={n} />
    </div>
  );
}
