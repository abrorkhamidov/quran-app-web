import { useSettings } from '../settings/useSettings';

export function FontSizeControl() {
  const { fontScale, setFontScale } = useSettings();
  return (
    <div className="flex items-center gap-2 text-muted">
      <button onClick={() => setFontScale(fontScale - 0.1)} className="text-sm" aria-label="Smaller text">A−</button>
      <span className="text-xs w-8 text-center">{Math.round(fontScale * 100)}%</span>
      <button onClick={() => setFontScale(fontScale + 0.1)} className="text-base" aria-label="Larger text">A+</button>
    </div>
  );
}
