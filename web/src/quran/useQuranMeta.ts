import { useQuery } from '@tanstack/react-query';
import type { Surah, Juz } from './quranIndex';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function useSurahs() {
  return useQuery({
    queryKey: ['surahs'],
    queryFn: () => fetchJson<Surah[]>('/quran/surahs.json'),
    staleTime: Infinity,
  });
}

export function useJuzList() {
  return useQuery({
    queryKey: ['juz'],
    queryFn: () => fetchJson<Juz[]>('/quran/juz.json'),
    staleTime: Infinity,
  });
}
