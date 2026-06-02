export type TajweedSegment = [text: string, rule: string | null];

// A word rendered on a Mushaf page — either a QCF glyph (mushaf mode) or
// tajweed-coloured Unicode segments (tajweed mode). Same layout either way.
export type RenderWord = {
  type: 'word' | 'end';
  surah: number;
  ayah: number;
  glyph?: string;
  segments?: TajweedSegment[];
};

export type MushafWord = {
  glyph: string;
  type: 'word' | 'end';
  surah: number;
  ayah: number;
};
export type MushafLine = { line: number; words: MushafWord[] };
export type MushafPageData = { page: number; lines: MushafLine[] };
