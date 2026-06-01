import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

type Bookmark = { surah: number; ayah: number; page: number };

export function useBookmark() {
  return useQuery({
    queryKey: ['bookmark'],
    queryFn: async (): Promise<Bookmark | null> => {
      const { data } = await api.get('/bookmark');
      return data && typeof data.page === 'number' ? data : null;
    },
  });
}

export function useSaveBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (page: number) => {
      const { data } = await api.put('/bookmark', { page });
      return data as Bookmark;
    },
    onSuccess: (data) => qc.setQueryData(['bookmark'], data),
  });
}
