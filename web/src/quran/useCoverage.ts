import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export type DimensionProgress = { id: number; ayahsRead: number; ayahCount: number; percent: number };
export type Coverage = {
  overall: { pagesRead: number; totalPages: number; percent: number };
  juz: DimensionProgress[];
  surah: DimensionProgress[];
};

export function useCoverage() {
  return useQuery({
    queryKey: ['coverage'],
    queryFn: async (): Promise<Coverage> => (await api.get('/quran/coverage')).data,
    // only changes after a reading flush, which invalidates this key explicitly
    staleTime: 60_000,
  });
}
