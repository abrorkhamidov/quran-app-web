import { useAuth } from '../auth/useAuth';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <span className="text-muted">Assalamu alaikum, {user?.name}</span>
        <button className="text-sm text-accent-soft" onClick={logout}>Log out</button>
      </div>
      <div className="bg-card-light dark:bg-card-dark rounded-2xl p-6 text-center">
        <p className="text-muted">Dashboard coming in Phase 6.</p>
      </div>
    </div>
  );
}
