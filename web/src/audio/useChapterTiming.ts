import type { ChapterTiming } from './types';

const cache = new Map<string, ChapterTiming>();

export async function loadChapterTiming(reciterId: number, chapter: number): Promise<ChapterTiming> {
  const key = `${reciterId}:${chapter}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`/audio/timings/${reciterId}/${chapter}.json`);
  if (!res.ok) throw new Error(`timing ${key}: ${res.status}`);
  const data: ChapterTiming = await res.json();
  cache.set(key, data);
  return data;
}
