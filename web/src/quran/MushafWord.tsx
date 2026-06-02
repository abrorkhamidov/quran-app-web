import type { RenderWord } from './types';
import { RULE_COLOR } from './tajweedColors';

export function MushafWord({
  word,
  position,
  selected,
  isPlaying,
  onSelect,
}: {
  word: RenderWord;
  position: number;
  selected: boolean;
  isPlaying: boolean;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  const tajweed = !!word.segments;
  const base = word.type === 'end' ? 'text-muted' : '';
  // playing highlight: solid for glyph; soft tint for tajweed so the colours stay legible
  const playing = isPlaying ? (tajweed ? 'bg-accent-soft/30 rounded' : 'bg-accent text-white rounded') : '';
  const sel = selected && !isPlaying ? 'bg-accent-soft/25 rounded' : '';

  return (
    <span
      className={`${base} ${playing} ${sel} cursor-pointer`}
      data-surah={word.surah}
      data-ayah={word.ayah}
      data-position={position}
      onClick={() => onSelect({ surah: word.surah, ayah: word.ayah })}
    >
      {tajweed
        ? word.type === 'end'
          ? `﴿${word.segments!.map((s) => s[0]).join('')}﴾`
          : word.segments!.map(([t, r], i) => (
              <span key={i} style={r ? { color: RULE_COLOR[r] } : undefined}>
                {t}
              </span>
            ))
        : word.glyph}
    </span>
  );
}
