import type { MushafWord as Word } from './types';
export function MushafWord({ word }: { word: Word }) {
  return (
    <span className={word.type === 'end' ? 'text-muted' : ''} data-surah={word.surah} data-ayah={word.ayah}>
      {word.glyph}
    </span>
  );
}
