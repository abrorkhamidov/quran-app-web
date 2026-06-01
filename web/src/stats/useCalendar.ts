import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export type CalendarDay = { date: string; secondsRead: number; versesRead: number; pagesRead: number; hasanat: number; goalMet: boolean };

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['stats-calendar', from, to],
    queryFn: async (): Promise<CalendarDay[]> => (await api.get(`/stats/calendar?from=${from}&to=${to}`)).data,
  });
}
