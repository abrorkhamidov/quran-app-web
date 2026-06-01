import { useQuery } from '@tanstack/react-query';
import type { Reciter } from './types';

export function useReciters() {
  return useQuery({
    queryKey: ['reciters'],
    queryFn: async (): Promise<Reciter[]> => (await fetch('/audio/reciters.json')).json(),
    staleTime: Infinity,
  });
}
