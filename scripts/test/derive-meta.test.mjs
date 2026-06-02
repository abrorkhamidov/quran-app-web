import { describe, it, expect } from 'vitest';
import { deriveSurahs, deriveJuz } from '../lib/derive-meta.mjs';

const ayahRef = [
  { surah: 1, ayah: 1, page: 1, juz: 1, letterCount: 19 },
  { surah: 1, ayah: 2, page: 1, juz: 1, letterCount: 17 },
  { surah: 1, ayah: 3, page: 1, juz: 1, letterCount: 12 },
  { surah: 2, ayah: 1, page: 2, juz: 1, letterCount: 8 },
  { surah: 2, ayah: 2, page: 2, juz: 1, letterCount: 40 },
  { surah: 2, ayah: 3, page: 3, juz: 2, letterCount: 30 },
];
const chapters = [
  { id: 1, name_simple: 'Al-Fatihah', name_arabic: 'الفاتحة', revelation_place: 'makkah' },
  { id: 2, name_simple: 'Al-Baqarah', name_arabic: 'البقرة', revelation_place: 'madinah' },
];

describe('deriveSurahs', () => {
  it('computes ayahCount (max ayah) and startPage (min page) and maps names/revelation', () => {
    const s = deriveSurahs(ayahRef, chapters);
    expect(s).toEqual([
      { id: 1, name: 'Al-Fatihah', arabicName: 'الفاتحة', ayahCount: 3, startPage: 1, revelation: 'meccan' },
      { id: 2, name: 'Al-Baqarah', arabicName: 'البقرة', ayahCount: 3, startPage: 2, revelation: 'medinan' },
    ]);
  });
});

describe('deriveJuz', () => {
  it('groups by juz with ayahCount and the first (surah,ayah,page) as start', () => {
    const j = deriveJuz(ayahRef);
    expect(j).toEqual([
      { juz: 1, startSurah: 1, startAyah: 1, startPage: 1, ayahCount: 5 },
      { juz: 2, startSurah: 2, startAyah: 3, startPage: 3, ayahCount: 1 },
    ]);
  });
});
