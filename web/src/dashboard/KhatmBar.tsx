import { useCoverage } from '../quran/useCoverage';

export function KhatmBar() {
  const { data: coverage } = useCoverage();
  const o = coverage?.overall;
  const percent = o?.percent ?? 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span className="uppercase tracking-[0.14em]">Qur'an completion</span>
        <span>{percent}% · {o?.pagesRead ?? 0}/{o?.totalPages ?? 604} pages</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark">
        <div className="h-full rounded-full bg-accent-soft transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
