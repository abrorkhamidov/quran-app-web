import { useTajweedPage } from './useTajweedPage';
import { RULE_COLOR, TAJWEED_LEGEND } from './tajweedColors';
import { useSettings } from '../settings/useSettings';

const arabicNum = (n: number) => n.toLocaleString('ar-EG');

export function TajweedPage({ page }: { page: number }) {
  const { data, isLoading, isError } = useTajweedPage(page);
  const { fontScale } = useSettings();

  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;

  return (
    <div>
      <div
        dir="rtl"
        className="font-quran text-ink dark:text-ink-dark px-6 sm:px-10 py-9 text-pretty"
        style={{ fontSize: `${29 * fontScale}px`, lineHeight: 2.5 }}
      >
        {data.ayahs.map((a) => (
          <span key={`${a.surah}:${a.ayah}`}>
            {a.segments.map(([t, r], i) => (
              <span key={i} style={r ? { color: RULE_COLOR[r] } : undefined}>
                {t}
              </span>
            ))}
            <span className="text-muted align-middle" style={{ fontSize: '0.62em' }}>
              {' '}﴿{arabicNum(a.ayah)}﴾{' '}
            </span>
          </span>
        ))}
      </div>

      <div className="border-t border-line-light dark:border-line-dark px-6 sm:px-10 py-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        {TAJWEED_LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
