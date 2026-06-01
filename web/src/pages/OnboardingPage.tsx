import { useNavigate } from 'react-router-dom';
import { useSettings } from '../settings/useSettings';
import type { GoalLevel } from '../settings/SettingsContext';

const LEVELS: { key: GoalLevel; name: string; blurb: string }[] = [
  { key: 'egg', name: 'Break the Egg', blurb: '2 minutes a day — the gentlest start' },
  { key: 'steady', name: 'Steady', blurb: '10 minutes a day — build a real habit' },
  { key: 'beast', name: 'Beast Mode', blurb: '30 minutes a day — go deep' },
];

export default function OnboardingPage() {
  const { completeOnboarding } = useSettings();
  const navigate = useNavigate();
  function pick(level: GoalLevel) { completeOnboarding(level); navigate('/'); }

  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-surface-light dark:bg-surface-dark">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-display text-3xl font-semibold tracking-tight">Wird</span>
            <span className="text-xs text-muted">وِرْد</span>
          </div>
        </div>

        <h1 className="mt-7 font-display text-2xl text-center">Set your daily goal</h1>
        <p className="mt-2 text-sm text-muted text-center">
          The most beloved deeds are those done consistently, even if small. Pick a level — you can change it anytime.
        </p>

        <div className="mt-6 space-y-3">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => pick(l.key)}
              className="w-full text-left rounded-2xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-5 transition hover:ring-2 hover:ring-accent-soft hover:-translate-y-0.5"
            >
              <div className="font-display text-lg">{l.name}</div>
              <div className="mt-0.5 text-sm text-muted">{l.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
