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
    <div className="min-h-screen p-6 max-w-md mx-auto flex flex-col justify-center space-y-4">
      <h1 className="text-2xl font-semibold text-center">Set your daily goal</h1>
      <p className="text-muted text-center text-sm">The most beloved deeds are those done consistently, even if small. Pick a level — you can change it anytime.</p>
      <div className="space-y-3 mt-2">
        {LEVELS.map((l) => (
          <button key={l.key} onClick={() => pick(l.key)} className="w-full text-left rounded-2xl bg-card-light dark:bg-card-dark p-4 hover:ring-2 hover:ring-accent-soft">
            <div className="font-medium">{l.name}</div>
            <div className="text-sm text-muted">{l.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
