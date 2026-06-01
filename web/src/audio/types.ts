export type WordSegment = [position: number, startMs: number, endMs: number];
export type VerseTiming = { from: number; to: number; segments: WordSegment[] };
export type ChapterTiming = {
  reciterId: number;
  chapter: number;
  audioUrl: string;
  durationMs: number;
  verses: Record<string, VerseTiming>; // key "surah:ayah"
};
export type Reciter = { id: number; slug: string; name: string };
export type HighlightedWord = { surah: number; ayah: number; position: number };
