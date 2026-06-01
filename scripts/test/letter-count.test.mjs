import { describe, it, expect } from 'vitest';
import { countArabicLetters } from '../lib/letter-count.mjs';

describe('countArabicLetters', () => {
  it('counts base Arabic letters, ignoring diacritics and spaces', () => {
    expect(countArabicLetters('بِسْمِ')).toBe(3); // ب س م
  });
  it('ignores spaces between words', () => {
    expect(countArabicLetters('اللَّهِ الرَّحْمَٰنِ')).toBe(countArabicLetters('اللَّه') + countArabicLetters('الرَّحمن'));
  });
  it('returns 0 for empty or non-Arabic input', () => {
    expect(countArabicLetters('')).toBe(0);
    expect(countArabicLetters('123 abc')).toBe(0);
  });
});
