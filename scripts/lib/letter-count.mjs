// Counts Arabic base letters (the rasm), excluding harakat/tanwin/sukun,
// tatweel, spaces, punctuation and annotation marks.
const BASE_LETTER = /[ء-غف-يٱ]/g;
export function countArabicLetters(text) {
  if (!text) return 0;
  const m = text.match(BASE_LETTER);
  return m ? m.length : 0;
}
