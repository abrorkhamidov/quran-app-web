import { useQuery } from '@tanstack/react-query';

export type TajweedSegment = [text: string, rule: string | null];
export type TajweedAyah = { surah: number; ayah: number; segments: TajweedSegment[] };
export type TajweedPageData = { page: number; ayahs: TajweedAyah[] };

async function fetchTajweed(page: number): Promise<TajweedPageData> {
  const res = await fetch(`/quran/tajweed/${page}.json`);
  if (!res.ok) throw new Error(`tajweed ${page}: ${res.status}`);
  return res.json();
}

export function useTajweedPage(page: number) {
  return useQuery({
    queryKey: ['tajweed-page', page],
    queryFn: () => fetchTajweed(page),
    staleTime: Infinity,
  });
}
