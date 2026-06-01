import { useSettings } from '../settings/useSettings';

export function ThemeToggle() {
  const { theme, toggleTheme } = useSettings();
  return (
    <button onClick={toggleTheme} className="text-sm text-muted hover:text-ink dark:hover:text-ink-dark" aria-label="Toggle theme">
      {theme === 'light' ? '☾' : '☀'}
    </button>
  );
}
