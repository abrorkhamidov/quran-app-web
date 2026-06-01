import type { MushafLine as Line } from './types';
import { MushafWord } from './MushafWord';
export function MushafLine({ line }: { line: Line }) {
  return (
    <div className="flex justify-center items-center gap-1 leading-[2.6] whitespace-nowrap" dir="rtl">
      {line.words.map((w, i) => (
        <MushafWord key={i} word={w} />
      ))}
    </div>
  );
}
