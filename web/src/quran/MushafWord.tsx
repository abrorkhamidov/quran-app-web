import type { MushafWord as Word } from './types';

export function MushafWord({
  word,
  selected,
  onSelect,
}: {
  word: Word;
  selected: boolean;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  const base = word.type === 'end' ? 'text-muted' : '';
  const hl = selected ? 'bg-accent-soft/25 rounded' : '';
  return (
    <span
      className={`${base} ${hl} cursor-pointer`}
      data-surah={word.surah}
      data-ayah={word.ayah}
      onClick={() => onSelect({ surah: word.surah, ayah: word.ayah })}
    >
      {word.glyph}
    </span>
  );
}
