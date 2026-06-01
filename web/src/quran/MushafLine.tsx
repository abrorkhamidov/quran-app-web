import type { MushafLine as Line } from './types';
import type { HighlightedWord } from '../audio/types';
import { MushafWord } from './MushafWord';

export function MushafLine({
  line,
  positions,
  selected,
  highlighted,
  onSelect,
}: {
  line: Line;
  positions: number[]; // position per word in this line, aligned by index
  selected: { surah: number; ayah: number } | null;
  highlighted: HighlightedWord | null;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  return (
    <div className="flex justify-center items-center gap-1 leading-[2.6] whitespace-nowrap" dir="rtl">
      {line.words.map((w, i) => (
        <MushafWord
          key={i}
          word={w}
          position={positions[i]}
          selected={!!selected && selected.surah === w.surah && selected.ayah === w.ayah}
          isPlaying={
            !!highlighted &&
            highlighted.surah === w.surah &&
            highlighted.ayah === w.ayah &&
            highlighted.position === positions[i]
          }
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
