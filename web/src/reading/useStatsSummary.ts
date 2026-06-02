import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type StatsSummary = {
  goal: { type: 'time' | 'ayahs'; target: number };
  today: { secondsRead: number; versesRead: number; pagesRead: number; hasanat: number; goalMet: boolean };
  lifetime: { seconds: number; verses: number; pages: number; hasanat: number };
  streak: { current: number; longest: number };
};

export function useStatsSummary() {
  return useQuery({
    queryKey: ['stats-summary'],
    queryFn: async (): Promise<StatsSummary> => (await api.get(`/stats/summary?date=${localDate()}`)).data,
  });
}
