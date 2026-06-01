import type { MushafLine as Line } from './types';
import { MushafWord } from './MushafWord';

export function MushafLine({
  line,
  selected,
  onSelect,
}: {
  line: Line;
  selected: { surah: number; ayah: number } | null;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  return (
    <div className="flex justify-center items-center gap-1 leading-[2.6] whitespace-nowrap" dir="rtl">
      {line.words.map((w, i) => (
        <MushafWord
          key={i}
          word={w}
          selected={!!selected && selected.surah === w.surah && selected.ayah === w.ayah}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
