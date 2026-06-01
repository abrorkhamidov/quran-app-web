import type { WeekDay } from './useWeek';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index by UTC day

function dowLetter(date: string) {
  return DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function WeekTracker({ week }: { week?: WeekDay[] }) {
  if (!week) return null;
  return (
    <div className="flex justify-between px-1">
      {week.map((d, i) => (
        <div key={d.date} className="flex flex-col items-center gap-1">
          <div
            className={
              'w-8 h-8 rounded-full grid place-items-center text-xs ' +
              (d.goalMet
                ? 'bg-accent-soft text-white'
                : i === week.length - 1
                  ? 'border border-accent-soft text-muted'
                  : 'border border-muted/30 text-muted')
            }
          >
            {dowLetter(d.date)}
          </div>
        </div>
      ))}
    </div>
  );
}
