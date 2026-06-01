import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useStatsSummary } from '../reading/useStatsSummary';
import { useWeek } from '../dashboard/useWeek';
import { StreakHero } from '../dashboard/StreakHero';
import { MetricCards } from '../dashboard/MetricCards';
import { WeekTracker } from '../dashboard/WeekTracker';
import { ContinueCard } from '../dashboard/ContinueCard';
import { ThemeToggle } from '../components/ThemeToggle';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { data: summary } = useStatsSummary();
  const { data: week } = useWeek();

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-muted">Assalamu alaikum, {user?.name}</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/settings" className="text-sm text-muted" aria-label="Settings">⚙</Link>
          <button className="text-sm text-accent-soft" onClick={logout}>Log out</button>
        </div>
      </div>
      <StreakHero summary={summary} />
      <MetricCards summary={summary} />
      <WeekTracker week={week} />
      <ContinueCard />
    </div>
  );
}
