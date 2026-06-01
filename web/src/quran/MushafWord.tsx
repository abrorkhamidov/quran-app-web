import type { MushafWord as Word } from './types';

export function MushafWord({
  word,
  position,
  selected,
  isPlaying,
  onSelect,
}: {
  word: Word;
  position: number;
  selected: boolean;
  isPlaying: boolean;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  const base = word.type === 'end' ? 'text-muted' : '';
  const playing = isPlaying ? 'bg-accent text-white rounded' : '';
  const sel = selected && !isPlaying ? 'bg-accent-soft/25 rounded' : '';
  return (
    <span
      className={`${base} ${playing} ${sel} cursor-pointer`}
      data-surah={word.surah}
      data-ayah={word.ayah}
      data-position={position}
      onClick={() => onSelect({ surah: word.surah, ayah: word.ayah })}
    >
      {word.glyph}
    </span>
  );
}
