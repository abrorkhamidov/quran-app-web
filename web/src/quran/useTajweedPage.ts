import { useQuery } from '@tanstack/react-query';
import type { RenderWord } from './types';

export type TajweedLine = { line: number; words: RenderWord[] };
export type TajweedPageData = { page: number; lines: TajweedLine[] };

async function fetchTajweed(page: number): Promise<TajweedPageData> {
  const res = await fetch(`/quran/tajweed/${page}.json`);
  if (!res.ok) throw new Error(`tajweed ${page}: ${res.status}`);
  return res.json();
}

export function useTajweedPage(page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['tajweed-page', page],
    queryFn: () => fetchTajweed(page),
    staleTime: Infinity,
    enabled,
  });
}
