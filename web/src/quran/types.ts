export type MushafWord = {
  glyph: string;
  type: 'word' | 'end';
  surah: number;
  ayah: number;
};
export type MushafLine = { line: number; words: MushafWord[] };
export type MushafPageData = { page: number; lines: MushafLine[] };
