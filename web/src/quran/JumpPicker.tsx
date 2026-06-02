import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSurahs, useJuzList } from './useQuranMeta';
import { pageForSurah, pageForJuz } from './quranIndex';

export function JumpPicker() {
  const navigate = useNavigate();
  const { data: surahs } = useSurahs();
  const { data: juz } = useJuzList();
  const [open, setOpen] = useState(false);

  const selectCls =
    'w-full rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark text-ink dark:text-ink-dark px-3 py-2 text-sm focus:outline-none';
  const opt = 'bg-card-light dark:bg-card-dark text-ink dark:text-ink-dark';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-line-light dark:border-line-dark px-3 py-1.5 text-sm text-muted hover:text-ink dark:hover:text-ink-dark transition"
      >
        Jump
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 space-y-3 rounded-2xl border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark p-4 shadow-lift">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-muted">Surah</div>
            <select
              className={selectCls}
              defaultValue=""
              onChange={(e) => {
                if (!surahs || !e.target.value) return;
                navigate(`/read/page/${pageForSurah(surahs, Number(e.target.value))}`);
                setOpen(false);
              }}
            >
              <option value="" className={opt}>Select surah…</option>
              {surahs?.map((s) => (
                <option key={s.id} value={s.id} className={opt}>{s.id}. {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-muted">Juz</div>
            <select
              className={selectCls}
              defaultValue=""
              onChange={(e) => {
                if (!juz || !e.target.value) return;
                navigate(`/read/page/${pageForJuz(juz, Number(e.target.value))}`);
                setOpen(false);
              }}
            >
              <option value="" className={opt}>Select juz…</option>
              {juz?.map((j) => (
                <option key={j.juz} value={j.juz} className={opt}>Juz {j.juz}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
