import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export type Favorite = { surah: number; ayah: number; page: number; createdAt?: string };

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async (): Promise<Favorite[]> => (await api.get('/favorites')).data,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { surah: number; ayah: number; favorited: boolean }) => {
      if (args.favorited) await api.delete(`/favorites/${args.surah}/${args.ayah}`);
      else await api.post('/favorites', { surah: args.surah, ayah: args.ayah });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
}
