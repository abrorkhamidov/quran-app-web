export type Surah = {
  id: number;
  name: string;
  arabicName: string;
  ayahCount: number;
  startPage: number;
  revelation: 'meccan' | 'medinan';
};

export type Juz = {
  juz: number;
  startSurah: number;
  startAyah: number;
  startPage: number;
  ayahCount: number;
};

/** 1-based cumulative ayah index across the whole Qur'an. Assumes `surahs` is sorted ascending by id (as produced by deriveSurahs). */
export function globalAyahIndex(surahs: Surah[], surah: number, ayah: number): number {
  let idx = 0;
  for (const s of surahs) {
    if (s.id < surah) idx += s.ayahCount;
    else break;
  }
  return idx + ayah;
}

/** The juz number containing (surah, ayah). */
export function juzOf(surahs: Surah[], juzs: Juz[], surah: number, ayah: number): number {
  const gi = globalAyahIndex(surahs, surah, ayah);
  let current = juzs[0]?.juz ?? 1;
  for (const j of juzs) {
    if (globalAyahIndex(surahs, j.startSurah, j.startAyah) <= gi) current = j.juz;
    else break;
  }
  return current;
}

/** Ayahs from (surah, ayah) inclusive to the end of its juz. */
export function ayahsLeftInJuz(surahs: Surah[], juzs: Juz[], surah: number, ayah: number): number {
  const gi = globalAyahIndex(surahs, surah, ayah);
  const jz = juzs.find((j) => j.juz === juzOf(surahs, juzs, surah, ayah));
  if (!jz) return 0;
  const startIdx = globalAyahIndex(surahs, jz.startSurah, jz.startAyah);
  const endIdx = startIdx + jz.ayahCount - 1;
  return endIdx - gi + 1;
}

export function pageForSurah(surahs: Surah[], id: number): number {
  return surahs.find((s) => s.id === id)?.startPage ?? 1;
}

export function pageForJuz(juzs: Juz[], n: number): number {
  return juzs.find((j) => j.juz === n)?.startPage ?? 1;
}
