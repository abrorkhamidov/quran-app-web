import { Link } from 'react-router-dom';
import { useBookmark } from '../reading/useBookmark';

export function ContinueCard() {
  const { data: bookmark } = useBookmark();
  const resumePage = bookmark?.page ?? 1;
  return (
    <div className="rounded-2xl bg-card-light dark:bg-card-dark p-4 space-y-3 text-center">
      <Link to={`/read/page/${resumePage}`} className="block rounded-lg bg-accent text-white py-3 font-medium">
        {bookmark ? `Continue · page ${resumePage}` : 'Start reading'}
      </Link>
      <div className="flex justify-center gap-4">
        <Link to="/favorites" className="text-sm text-accent-soft">View favorites</Link>
        <Link to="/stats" className="text-sm text-accent-soft">View stats</Link>
      </div>
    </div>
  );
}
