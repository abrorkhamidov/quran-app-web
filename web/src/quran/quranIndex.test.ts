import { describe, it, expect } from 'vitest';
import { globalAyahIndex, juzOf, ayahsLeftInJuz, pageForSurah, pageForJuz } from './quranIndex';
import type { Surah, Juz } from './quranIndex';

const surahs: Surah[] = [
  { id: 1, name: 'Al-Fatihah', arabicName: 'الفاتحة', ayahCount: 3, startPage: 1, revelation: 'meccan' },
  { id: 2, name: 'Al-Baqarah', arabicName: 'البقرة', ayahCount: 3, startPage: 2, revelation: 'medinan' },
];
const juzs: Juz[] = [
  { juz: 1, startSurah: 1, startAyah: 1, startPage: 1, ayahCount: 5 },
  { juz: 2, startSurah: 2, startAyah: 3, startPage: 3, ayahCount: 1 },
];

describe('quranIndex', () => {
  it('globalAyahIndex is a 1-based cumulative index', () => {
    expect(globalAyahIndex(surahs, 1, 1)).toBe(1);
    expect(globalAyahIndex(surahs, 2, 1)).toBe(4);
    expect(globalAyahIndex(surahs, 2, 3)).toBe(6);
  });
  it('juzOf finds the containing juz', () => {
    expect(juzOf(surahs, juzs, 1, 1)).toBe(1);
    expect(juzOf(surahs, juzs, 2, 2)).toBe(1);
    expect(juzOf(surahs, juzs, 2, 3)).toBe(2);
  });
  it('ayahsLeftInJuz counts inclusive to end of the juz', () => {
    expect(ayahsLeftInJuz(surahs, juzs, 1, 1)).toBe(5);
    expect(ayahsLeftInJuz(surahs, juzs, 1, 2)).toBe(4);
    expect(ayahsLeftInJuz(surahs, juzs, 2, 2)).toBe(1);
    expect(ayahsLeftInJuz(surahs, juzs, 2, 3)).toBe(1);
  });
  it('page lookups', () => {
    expect(pageForSurah(surahs, 2)).toBe(2);
    expect(pageForJuz(juzs, 2)).toBe(3);
  });
});
