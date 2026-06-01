import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useBookmark } from '../reading/useBookmark';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { data: bookmark } = useBookmark();
  const resumePage = bookmark?.page ?? 1;
  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <span className="text-muted">Assalamu alaikum, {user?.name}</span>
        <button className="text-sm text-accent-soft" onClick={logout}>Log out</button>
      </div>
      <div className="bg-card-light dark:bg-card-dark rounded-2xl p-6 text-center space-y-3">
        <Link to={`/read/page/${resumePage}`} className="inline-block rounded-lg bg-accent text-white px-4 py-2">
          {bookmark ? `Continue · page ${resumePage}` : 'Start reading'}
        </Link>
        <div><Link to="/favorites" className="text-sm text-accent-soft">View favorites</Link></div>
      </div>
    </div>
  );
}
