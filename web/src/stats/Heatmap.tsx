import { buildHeatmapWeeks } from './dateUtils';

const LEVELS = ['bg-muted/15', 'bg-accent-soft/30', 'bg-accent-soft/55', 'bg-accent-soft/80', 'bg-accent-soft'];

function level(seconds: number): number {
  const m = seconds / 60;
  if (m <= 0) return 0;
  if (m < 5) return 1;
  if (m < 15) return 2;
  if (m < 30) return 3;
  return 4;
}

export function Heatmap({ end, secondsByDate }: { end: string; secondsByDate: Map<string, number> }) {
  const weeks = buildHeatmapWeeks(end, 17);
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-1">
          {col.map((date) => {
            const future = date > end;
            const lvl = level(secondsByDate.get(date) ?? 0);
            return (
              <div
                key={date}
                title={`${date}: ${Math.round((secondsByDate.get(date) ?? 0) / 60)} min`}
                className={`w-3 h-3 rounded-sm ${future ? 'opacity-0' : LEVELS[lvl]}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
