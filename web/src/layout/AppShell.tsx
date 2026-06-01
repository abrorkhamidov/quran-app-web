import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ComponentType } from 'react';
import { useAuth } from '../auth/useAuth';
import { useSettings } from '../settings/useSettings';
import { useStatsSummary } from '../reading/useStatsSummary';
import { useBookmark } from '../reading/useBookmark';
import { BookIcon, ChartIcon, FlameIcon, GearIcon, HeartIcon, HomeIcon } from './icons';

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; prefix: string; end?: boolean };

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={[
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
        active
          ? 'bg-accent/10 text-ink dark:text-ink-dark font-medium'
          : 'text-muted hover:text-ink dark:hover:text-ink-dark hover:bg-line-light/60 dark:hover:bg-line-dark/50',
      ].join(' ')}
    >
      <Icon className={`h-[18px] w-[18px] ${active ? 'text-accent-soft' : ''}`} />
      <span>{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-soft" />}
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useSettings();
  const { data: summary } = useStatsSummary();
  const { data: bookmark } = useBookmark();
  const location = useLocation();
  const resume = bookmark?.page ?? 1;
  const streak = summary?.streak.current ?? 0;
  const onRead = location.pathname.startsWith('/read');

  const items: NavItem[] = [
    { to: '/', label: 'Home', icon: HomeIcon, prefix: '/', end: true },
    { to: `/read/page/${resume}`, label: 'Read', icon: BookIcon, prefix: '/read' },
    { to: '/stats', label: 'Stats', icon: ChartIcon, prefix: '/stats' },
    { to: '/favorites', label: 'Favorites', icon: HeartIcon, prefix: '/favorites' },
    { to: '/settings', label: 'Settings', icon: GearIcon, prefix: '/settings' },
  ];
  const isActive = (it: NavItem) => (it.end ? location.pathname === it.prefix : location.pathname.startsWith(it.prefix));

  return (
    <div className="min-h-dvh">
      {/* desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line-light dark:border-line-dark bg-sidebar-light dark:bg-sidebar-dark">
        <div className="px-5 pt-6 pb-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-tight">Wird</span>
            <span className="text-[11px] text-muted">وِرْد</span>
          </Link>
          <p className="mt-1 text-xs text-muted">a quiet daily portion</p>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {items.map((it) => (
            <NavRow key={it.label} item={it} active={isActive(it)} />
          ))}
        </nav>

        <div className="px-3 pb-4 space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-surface-light dark:bg-surface-dark px-3 py-2.5">
            <FlameIcon className="h-4 w-4 text-accent-soft" />
            <span className="font-display text-lg leading-none">{streak}</span>
            <span className="text-xs text-muted">day{streak === 1 ? '' : 's'}</span>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="truncate text-xs text-muted">{user?.name}</span>
            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="text-muted hover:text-ink dark:hover:text-ink-dark" aria-label="Toggle theme">
                {theme === 'light' ? '☾' : '☀'}
              </button>
              <button onClick={logout} className="text-xs text-muted hover:text-ink dark:hover:text-ink-dark">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-line-light dark:border-line-dark bg-sidebar-light/90 dark:bg-sidebar-dark/90 backdrop-blur px-4 py-3">
        <Link to="/" className="font-display text-xl font-semibold">Wird</Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-muted"><FlameIcon className="h-3.5 w-3.5 text-accent-soft" />{streak}</span>
          <button onClick={toggleTheme} className="text-muted" aria-label="Toggle theme">{theme === 'light' ? '☾' : '☀'}</button>
          <button onClick={logout} className="text-xs text-muted">Sign out</button>
        </div>
      </header>

      {/* main content */}
      <main className={`md:pl-60 ${onRead ? '' : 'pb-24 md:pb-0'}`}>
        <Outlet />
      </main>

      {/* mobile bottom nav (hidden while reading for focus) */}
      {!onRead && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-5 border-t border-line-light dark:border-line-dark bg-sidebar-light/95 dark:bg-sidebar-dark/95 backdrop-blur">
          {items.map((it) => {
            const Icon = it.icon;
            const active = isActive(it);
            return (
              <NavLink key={it.label} to={it.to} end={it.end} className="flex flex-col items-center gap-1 py-2.5 text-[10px]">
                <Icon className={`h-5 w-5 ${active ? 'text-accent-soft' : 'text-muted'}`} />
                <span className={active ? 'text-ink dark:text-ink-dark' : 'text-muted'}>{it.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
