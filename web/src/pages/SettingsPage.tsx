import { Link } from 'react-router-dom';
import { useSettings } from '../settings/useSettings';
import type { GoalLevel } from '../settings/SettingsContext';
import { useReciters } from '../audio/useReciters';

const LEVELS: { key: GoalLevel; name: string; secs: string }[] = [
  { key: 'egg', name: 'Break the Egg', secs: '2 min' },
  { key: 'steady', name: 'Steady', secs: '10 min' },
  { key: 'beast', name: 'Beast Mode', secs: '30 min' },
];

export default function SettingsPage() {
  const { goalLevel, setGoalLevel, reciterId, setReciterId, theme, toggleTheme, fontScale, setFontScale } = useSettings();
  const { data: reciters } = useReciters();

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-accent-soft">‹ Home</Link>
        <h1 className="text-lg font-semibold">Settings</h1>
        <span className="w-10" />
      </div>

      <section className="space-y-2">
        <div className="text-xs uppercase text-muted">Daily goal</div>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button key={l.key} onClick={() => setGoalLevel(l.key)}
              className={'rounded-xl p-3 text-center ' + (goalLevel === l.key ? 'bg-accent text-white' : 'bg-card-light dark:bg-card-dark')}>
              <div className="text-sm font-medium">{l.name}</div>
              <div className="text-xs opacity-70">{l.secs}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-xs uppercase text-muted">Reciter</div>
        <select className="w-full rounded-lg bg-card-light dark:bg-card-dark p-3" value={reciterId} onChange={(e) => setReciterId(Number(e.target.value))}>
          {reciters?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </section>

      <section className="flex items-center justify-between">
        <div className="text-xs uppercase text-muted">Theme</div>
        <button onClick={toggleTheme} className="rounded-lg bg-card-light dark:bg-card-dark px-4 py-2 text-sm">{theme === 'light' ? '☾ Dark' : '☀ Light'}</button>
      </section>

      <section className="flex items-center justify-between">
        <div className="text-xs uppercase text-muted">Arabic font size</div>
        <div className="flex items-center gap-3">
          <button onClick={() => setFontScale(fontScale - 0.1)} className="text-muted">A−</button>
          <span className="text-sm w-10 text-center">{Math.round(fontScale * 100)}%</span>
          <button onClick={() => setFontScale(fontScale + 0.1)} className="text-lg">A+</button>
        </div>
      </section>
    </div>
  );
}
