import { useQuery } from '@tanstack/react-query';

export type AyahText = { surah: number; ayah: number; text: string; translation: string };

/** Loads the given surahs' ayah text+translation and returns a `${surah}:${ayah}` → AyahText map. */
export function useAyahTexts(surahs: number[]) {
  const key = [...surahs].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['ayah-text', key],
    enabled: key.length > 0,
    staleTime: Infinity,
    queryFn: async (): Promise<Map<string, AyahText>> => {
      const lists = await Promise.all(
        key.map((s) =>
          fetch(`/quran/ayahs/${s}.json`).then((r) => {
            if (!r.ok) throw new Error(`ayahs ${s}: ${r.status}`);
            return r.json() as Promise<AyahText[]>;
          }),
        ),
      );
      const map = new Map<string, AyahText>();
      for (const list of lists) for (const a of list) map.set(`${a.surah}:${a.ayah}`, a);
      return map;
    },
  });
}
