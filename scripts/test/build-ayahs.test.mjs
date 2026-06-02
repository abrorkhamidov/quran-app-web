import { describe, it, expect } from 'vitest';
import { stripHtml, buildAyahList } from '../lib/build-ayahs.mjs';

describe('stripHtml', () => {
  it('drops footnote markers entirely, strips other tags, and collapses whitespace', () => {
    expect(stripHtml('This is the Book<sup foot_note=1>1</sup> about which')).toBe('This is the Book about which');
    expect(stripHtml('In the name of Allāh,<sup foot_note=1>1</sup> the Merciful')).toBe('In the name of Allāh, the Merciful');
    expect(stripHtml('  spaced   out\n text ')).toBe('spaced out text');
  });
});

describe('buildAyahList', () => {
  it('zips uthmani verses with cleaned translations by index', () => {
    const uthmani = [
      { verse_key: '2:1', text_uthmani: 'الٓمٓ' },
      { verse_key: '2:2', text_uthmani: 'ذَٰلِكَ ٱلْكِتَٰبُ' },
    ];
    const translations = [
      { text: 'Alif, Lam, Meem.' },
      { text: 'This is the Book<sup foot_note=8>1</sup> about which' },
    ];
    expect(buildAyahList(2, uthmani, translations)).toEqual([
      { surah: 2, ayah: 1, text: 'الٓمٓ', translation: 'Alif, Lam, Meem.' },
      { surah: 2, ayah: 2, text: 'ذَٰلِكَ ٱلْكِتَٰبُ', translation: 'This is the Book about which' },
    ]);
  });

  it('throws when lengths differ', () => {
    expect(() => buildAyahList(1, [{ verse_key: '1:1', text_uthmani: 'x' }], [])).toThrow();
  });
});
