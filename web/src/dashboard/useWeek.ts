import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { localDate } from '../reading/useStatsSummary';

export type WeekDay = { date: string; goalMet: boolean; secondsRead: number };

export function useWeek() {
  return useQuery({
    queryKey: ['stats-week'],
    queryFn: async (): Promise<WeekDay[]> => (await api.get(`/stats/week?date=${localDate()}`)).data,
  });
}
