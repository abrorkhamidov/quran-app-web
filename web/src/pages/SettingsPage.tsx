import { useEffect } from 'react';
import { useSettings } from '../settings/useSettings';
import type { GoalLevel } from '../settings/SettingsContext';
import { useReciters } from '../audio/useReciters';

const LEVELS: { key: GoalLevel; name: string; secs: string }[] = [
  { key: 'egg', name: 'Break the Egg', secs: '2 min' },
  { key: 'steady', name: 'Steady', secs: '10 min' },
  { key: 'beast', name: 'Beast Mode', secs: '30 min' },
];

export default function SettingsPage() {
  const { goalLevel, setGoalLevel, reciterId, setReciterId, theme, toggleTheme, fontScale, setFontScale, readingStyle, setReadingStyle } = useSettings();
  const { data: reciters } = useReciters();

  // keep the selected reciter valid — a stored id missing from the list renders the <select> blank
  const validReciterId = reciters?.some((r) => r.id === reciterId) ? reciterId : reciters?.[0]?.id;
  useEffect(() => {
    if (reciters?.length && validReciterId != null && validReciterId !== reciterId) setReciterId(validReciterId);
  }, [reciters, validReciterId, reciterId, setReciterId]);

  const styles: { key: 'mushaf' | 'tajweed'; name: string; blurb: string }[] = [
    { key: 'mushaf', name: 'Mushaf', blurb: 'Page-faithful QCF script' },
    { key: 'tajweed', name: 'Tajwīd', blurb: 'Colour-coded rules' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 lg:px-12 py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">Settings</h1>
        <p className="mt-1 text-muted">Tune your daily practice.</p>
      </header>

      <div className="space-y-5">
        <section className="rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <div className="text-xs uppercase tracking-[0.14em] text-muted mb-4">Daily goal</div>
          <div className="grid grid-cols-3 gap-3">
            {LEVELS.map((l) => {
              const selected = goalLevel === l.key;
              return (
                <button
                  key={l.key}
                  onClick={() => setGoalLevel(l.key)}
                  className={
                    'rounded-2xl p-4 text-center border transition ' +
                    (selected
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface-light dark:bg-surface-dark border-line-light dark:border-line-dark hover:border-accent-soft')
                  }
                >
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className={'text-xs mt-0.5 ' + (selected ? 'opacity-80' : 'text-muted')}>{l.secs}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <div className="text-xs uppercase tracking-[0.14em] text-muted mb-4">Reading style</div>
          <div className="grid grid-cols-2 gap-3">
            {styles.map((s) => {
              const selected = readingStyle === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setReadingStyle(s.key)}
                  className={
                    'rounded-2xl p-4 text-center border transition ' +
                    (selected
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface-light dark:bg-surface-dark border-line-light dark:border-line-dark hover:border-accent-soft')
                  }
                >
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className={'text-xs mt-0.5 ' + (selected ? 'opacity-80' : 'text-muted')}>{s.blurb}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <div className="text-xs uppercase tracking-[0.14em] text-muted mb-4">Reciter</div>
          <select
            className="w-full rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark text-ink dark:text-ink-dark px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-soft/40"
            value={validReciterId ?? reciterId}
            onChange={(e) => setReciterId(Number(e.target.value))}
          >
            {reciters?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </section>

        <section className="rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">Theme</div>
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark px-4 py-2 text-sm hover:border-accent-soft transition"
          >
            {theme === 'light' ? '☾ Dark' : '☀ Light'}
          </button>
        </section>

        <section className="rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">Arabic font size</div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFontScale(fontScale - 0.1)}
              className="h-9 w-9 grid place-items-center rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark text-muted hover:border-accent-soft transition"
              aria-label="Decrease font size"
            >
              A−
            </button>
            <span className="font-display text-lg w-14 text-center">{Math.round(fontScale * 100)}%</span>
            <button
              onClick={() => setFontScale(fontScale + 0.1)}
              className="h-9 w-9 grid place-items-center rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark text-lg hover:border-accent-soft transition"
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
