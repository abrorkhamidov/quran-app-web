import { useQuery } from '@tanstack/react-query';
import type { MushafPageData } from './types';

async function fetchPage(page: number): Promise<MushafPageData> {
  const res = await fetch(`/quran/pages/${page}.json`);
  if (!res.ok) throw new Error(`page ${page}: ${res.status}`);
  return res.json();
}
export function usePageData(page: number) {
  return useQuery({
    queryKey: ['quran-page', page],
    queryFn: () => fetchPage(page),
    staleTime: Infinity,
  });
}
